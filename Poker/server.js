const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const readline = require('readline');
const http = require('http');
const WebSocket = require('ws');

const app = express();
app.use(express.json());

const DATA_DIR = path.join(__dirname, 'data');
const USER_FILE = path.join(DATA_DIR, 'user_data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

function ensureUserFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USER_FILE)) {
    fs.writeFileSync(USER_FILE, JSON.stringify({}, null, 2));
  }
}

function readUsers() {
  ensureUserFile();
  try {
    const text = fs.readFileSync(USER_FILE, 'utf-8');
    return JSON.parse(text || '{}');
  } catch (err) {
    console.error('Failed to read users', err);
    return {};
  }
}

function writeUsers(data) {
  ensureUserFile();
  fs.writeFileSync(USER_FILE, JSON.stringify(data, null, 2));
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const rooms = new Map();
let nextRoomId = 1;

class EngineBridge {
  constructor(roomId, mode) {
    this.roomId = roomId;
    this.mode = mode;
    this.proc = null;
    this.queue = [];
    this.closed = false;
    this.log = [];
    this.spawn();
  }

  spawn() {
    try {
      this.proc = spawn('./poker.exe', [this.mode], { cwd: __dirname });
    } catch (err) {
      console.warn('Failed to spawn poker.exe', err);
      this.closed = true;
      return;
    }

    this.proc.on('error', (err) => {
      console.warn('Engine error', err);
      this.closed = true;
    });
    this.proc.on('exit', () => {
      this.closed = true;
    });

    this.rl = readline.createInterface({ input: this.proc.stdout });
    this.proc.stderr.on('data', (chunk) => {
      console.warn(`engine stderr [${this.roomId}]: ${chunk.toString()}`);
    });
    this.rl.on('line', (line) => {
      const trimmed = line.trim();
      this.log.push(trimmed);
      if (this.queue.length > 0) {
        const current = this.queue[0];
        current.lines.push(trimmed);
        if (current.lines.length >= current.lineCount) {
          current.resolve(current.lines);
          this.queue.shift();
        }
      }
    });
  }

  async send(command, lineCount = 1) {
    if (this.closed || !this.proc) {
      throw new Error('engine-not-available');
    }
    return new Promise((resolve, reject) => {
      const entry = { resolve, reject, lineCount, lines: [] };
      this.queue.push(entry);
      try {
        this.proc.stdin.write(`${command}\n`);
      } catch (err) {
        this.queue = this.queue.filter((q) => q !== entry);
        reject(err);
      }
    });
  }

  async shutdown() {
    if (this.proc && !this.closed) {
      try {
        this.proc.stdin.write('exit\n');
      } catch (err) {
        // ignore
      }
    }
  }
}

function broadcast(roomId, payload) {
  const connections = wsRooms.get(roomId) || new Set();
  for (const ws of connections) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }
}

function basicRoomView(room) {
  return {
    id: room.id,
    mode: room.mode,
    host: room.host,
    status: room.status,
    players: room.players.map((p) => ({
      name: p.name,
      ready: p.ready,
      color: p.color,
      score: p.score || 0,
    })),
  };
}

function generateColor() {
  const colors = ['#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#4db6ac', '#f06292', '#7986cb'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function getRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    const err = new Error('Room not found');
    err.status = 404;
    throw err;
  }
  return room;
}

function ensurePlayer(room, username) {
  const existing = room.players.find((p) => p.name === username);
  if (!existing) {
    const err = new Error('not-in-room');
    err.status = 400;
    throw err;
  }
  return existing;
}

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: '缺少用户名或密码' });
  }
  const users = readUsers();
  if (users[username]) {
    return res.status(409).json({ message: '用户已存在' });
  }
  users[username] = hashPassword(password);
  writeUsers(users);
  res.json({ message: '注册成功' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: '缺少用户名或密码' });
  }
  const users = readUsers();
  if (!users[username]) {
    return res.status(404).json({ message: '用户未注册，是否自动使用此用户名与密码注册', status: 'not-registered' });
  }
  const hashed = hashPassword(password);
  if (users[username] !== hashed) {
    return res.status(401).json({ message: '密码错误，请联系网站所有者验证身份' });
  }
  res.json({ message: '登录成功' });
});

app.get('/api/rooms', (req, res) => {
  const { mode } = req.query;
  const data = Array.from(rooms.values())
    .filter((room) => !mode || room.mode === mode)
    .map((room) => basicRoomView(room));
  res.json({ rooms: data });
});

app.post('/api/rooms', (req, res) => {
  const { username, mode } = req.body;
  if (!username || !mode) {
    return res.status(400).json({ message: '缺少参数' });
  }
  const id = String(nextRoomId++);
  const bridge = new EngineBridge(id, mode);
  const warning = bridge.closed ? '未找到poker.exe，后台未启动' : null;
  const room = {
    id,
    mode,
    host: username,
    status: 'waiting',
    players: [{ name: username, ready: false, color: generateColor(), score: 0, hand: [], discard: [], history: [] }],
    activePlayers: [],
    bridge,
    warning,
    currentTurn: null,
    lastStartSeat: null,
  };
  rooms.set(id, room);
  broadcast(id, { type: 'state', room: basicRoomView(room), warning });
  res.json({ room: basicRoomView(room), warning });
});

app.post('/api/rooms/:roomId/join', (req, res) => {
  const { username } = req.body;
  const room = getRoom(req.params.roomId);
  if (room.players.find((p) => p.name === username)) {
    return res.json({ room: basicRoomView(room) });
  }
  room.players.push({ name: username, ready: false, color: generateColor(), score: 0, hand: [], discard: [], history: [] });
  broadcast(room.id, { type: 'state', room: basicRoomView(room) });
  res.json({ room: basicRoomView(room) });
});

app.post('/api/rooms/:roomId/leave', (req, res) => {
  const { username } = req.body;
  const room = getRoom(req.params.roomId);
  room.players = room.players.filter((p) => p.name !== username);
  if (room.host === username || room.players.length === 0) {
    room.bridge.shutdown();
    rooms.delete(room.id);
    broadcast(room.id, { type: 'closed', reason: '房主离开，房间关闭' });
    return res.json({ message: '房间已关闭' });
  }
  broadcast(room.id, { type: 'state', room: basicRoomView(room) });
  res.json({ room: basicRoomView(room) });
});

app.post('/api/rooms/:roomId/ready', (req, res) => {
  const { username, ready } = req.body;
  const room = getRoom(req.params.roomId);
  const player = ensurePlayer(room, username);
  player.ready = !!ready;
  broadcast(room.id, { type: 'state', room: basicRoomView(room) });
  res.json({ room: basicRoomView(room) });
});

app.post('/api/rooms/:roomId/start', async (req, res) => {
  const { username, selectedPlayers } = req.body;
  const room = getRoom(req.params.roomId);
  if (room.host !== username) {
    return res.status(403).json({ message: '只有房主可以开始游戏' });
  }
  if (room.bridge.closed) {
    return res.status(500).json({ message: '后台程序未运行，无法开始' });
  }
  const readyPlayers = room.players.filter((p) => p.ready);
  if (readyPlayers.length === 0) {
    return res.status(400).json({ message: '没有玩家准备' });
  }
  let minPlayers = 0;
  let maxPlayers = readyPlayers.length;
  try {
    const [line] = await room.bridge.send('player_number', 1);
    const [min, max] = line.split(/\s+/).map((x) => parseInt(x, 10)).filter((x) => !Number.isNaN(x));
    minPlayers = min || minPlayers;
    maxPlayers = max || maxPlayers;
  } catch (err) {
    console.warn('player_number error', err);
  }

  if (readyPlayers.length < minPlayers) {
    return res.status(400).json({ message: `至少需要${minPlayers}名玩家准备` });
  }
  let active = readyPlayers;
  if (readyPlayers.length > maxPlayers) {
    if (!Array.isArray(selectedPlayers) || selectedPlayers.length < minPlayers || selectedPlayers.length > maxPlayers) {
      return res.status(400).json({
        message: '准备人数超过上限，请选择进入本局的玩家',
        needsSelection: true,
        minPlayers,
        maxPlayers,
        readyPlayers: readyPlayers.map((p) => p.name),
      });
    }
    const allowed = new Set(selectedPlayers);
    active = readyPlayers.filter((p) => allowed.has(p.name));
    room.players = room.players.filter((p) => allowed.has(p.name));
    broadcast(room.id, { type: 'redirect', players: readyPlayers.filter((p) => !allowed.has(p.name)).map((p) => p.name) });
  }

  room.status = 'playing';
  room.activePlayers = active.map((p) => ({ ...p, hand: [], discard: [], history: [], score: p.score || 0 }));
  try {
    const [deckLine, starterLine] = await room.bridge.send('init_hand', 2);
    const deck = deckLine.split(/\s+/).filter(Boolean);
    const starterIndexRaw = parseInt(starterLine, 10);
    const totalPlayers = room.activePlayers.length;
    const startIndex = Number.isNaN(starterIndexRaw) ? 0 : ((starterIndexRaw % totalPlayers) + totalPlayers) % totalPlayers;
    room.lastStartSeat = startIndex;
    deck.forEach((card, idx) => {
      const seat = (startIndex + idx) % totalPlayers;
      room.activePlayers[seat].hand.push(card);
    });
    room.currentTurn = startIndex;
  } catch (err) {
    console.warn('init_hand error', err);
  }

  broadcast(room.id, { type: 'game-start', room: basicRoomView(room), activePlayers: room.activePlayers, currentTurn: room.currentTurn, startSeat: room.lastStartSeat });
  res.json({ room: basicRoomView(room), activePlayers: room.activePlayers, currentTurn: room.currentTurn, startSeat: room.lastStartSeat });
});

app.post('/api/rooms/:roomId/play', async (req, res) => {
  const { username, cards } = req.body;
  const room = getRoom(req.params.roomId);
  if (room.status !== 'playing') {
    return res.status(400).json({ message: '游戏未开始' });
  }
  const playerIndex = room.activePlayers.findIndex((p) => p.name === username);
  if (playerIndex === -1) {
    return res.status(400).json({ message: '不在当前牌局中' });
  }
  const command = Array.isArray(cards) ? cards.join(' ') : String(cards || '').trim();
  if (!command) {
    return res.status(400).json({ message: '请选择要出的牌' });
  }
  try {
    const [result] = await room.bridge.send(command, 1);
    if (result === 'fail') {
      return res.status(400).json({ message: '牌型错误请重新出牌', raw: result });
    }
    if (result === 'end') {
      room.status = 'waiting';
      room.currentTurn = null;
      broadcast(room.id, { type: 'point', ended: true, room: basicRoomView(room), activePlayers: [], currentTurn: null });
      return res.json({ message: '牌局已结束', room: basicRoomView(room), activePlayers: [], ended: true });
    }
    const hand = room.activePlayers[playerIndex].hand;
    const discards = command.split(/\s+/).filter(Boolean);
    room.activePlayers[playerIndex].hand = hand.filter((c) => !discards.includes(c) || (discards.splice(discards.indexOf(c), 1), false));
    room.activePlayers[playerIndex].discard.push(...command.split(/\s+/).filter(Boolean));
    broadcast(room.id, { type: 'play', player: username, cards: command.split(/\s+/).filter(Boolean), room: basicRoomView(room), activePlayers: room.activePlayers });
    res.json({ message: '出牌成功', room: basicRoomView(room), activePlayers: room.activePlayers });
  } catch (err) {
    res.status(500).json({ message: '出牌失败', error: err.message });
  }
});

app.post('/api/rooms/:roomId/point', async (req, res) => {
  const room = getRoom(req.params.roomId);
  if (room.status !== 'playing') {
    return res.status(400).json({ message: '游戏未开始' });
  }
  try {
    const [scoreLine, starterLine] = await room.bridge.send('point', 2);
    if (scoreLine === 'end') {
      room.status = 'waiting';
      room.activePlayers = [];
      room.currentTurn = null;
      broadcast(room.id, { type: 'point', scores: [], ended: true, room: basicRoomView(room), activePlayers: [], currentTurn: null });
      return res.json({ scores: [], ended: true, room: basicRoomView(room), activePlayers: [], currentTurn: null });
    }
    const scores = scoreLine.split(/\s+/).map((v) => parseInt(v, 10));
    scores.forEach((value, idx) => {
      if (!Number.isNaN(value) && room.activePlayers[idx]) {
        room.activePlayers[idx].score = (room.activePlayers[idx].score || 0) + value;
      }
    });
    const next = starterLine.trim();
    const ended = next === 'end';
    if (!ended) {
      const startIndex = parseInt(next, 10);
      if (!Number.isNaN(startIndex)) {
        room.currentTurn = startIndex;
      }
      room.activePlayers.forEach((p) => {
        if (p.discard && p.discard.length) {
          p.history = (p.history || []).concat(p.discard);
          p.discard = [];
        }
      });
    } else {
      room.status = 'waiting';
      room.activePlayers = [];
      room.currentTurn = null;
    }
    broadcast(room.id, { type: 'point', scores: room.activePlayers.map((p) => p.score), ended, room: basicRoomView(room), activePlayers: room.activePlayers, currentTurn: room.currentTurn });
    res.json({ scores: room.activePlayers.map((p) => p.score), ended, room: basicRoomView(room), activePlayers: room.activePlayers, currentTurn: room.currentTurn });
  } catch (err) {
    res.status(500).json({ message: '请求得分失败', error: err.message });
  }
});

app.post('/api/rooms/:roomId/end', async (req, res) => {
  const { username, confirm } = req.body;
  const room = getRoom(req.params.roomId);
  if (room.host !== username || !confirm) {
    return res.status(403).json({ message: '需要房主确认才能结束牌局' });
  }
  room.status = 'waiting';
  room.activePlayers = [];
  room.currentTurn = null;
  room.bridge.shutdown();
  rooms.delete(room.id);
  broadcast(room.id, { type: 'closed', reason: '房主结束牌局' });
  res.json({ message: '牌局结束' });
});

app.use(express.static(PUBLIC_DIR));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const wsRooms = new Map();

wss.on('connection', (ws) => {
  let currentRoomId = null;
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'join-room') {
        currentRoomId = msg.roomId;
        if (!wsRooms.has(currentRoomId)) {
          wsRooms.set(currentRoomId, new Set());
        }
        wsRooms.get(currentRoomId).add(ws);
      }
    } catch (err) {
      console.warn('ws parse error', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomId && wsRooms.has(currentRoomId)) {
      wsRooms.get(currentRoomId).delete(ws);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  ensureUserFile();
  console.log(`Poker lobby running on http://localhost:${PORT}`);
});
