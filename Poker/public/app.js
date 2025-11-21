const views = {
  login: document.getElementById('view-login'),
  home: document.getElementById('view-home'),
  room: document.getElementById('view-room'),
  game: document.getElementById('view-game'),
};

const userBar = document.getElementById('user-bar');
const loginMessage = document.getElementById('login-message');
const roomListEl = document.getElementById('room-list');
const playerListEl = document.getElementById('player-list');
const roomTitle = document.getElementById('room-title');
const roomWarning = document.getElementById('room-warning');
const selectionPanel = document.getElementById('selection-panel');
const myHandEl = document.getElementById('my-hand');
const tableEl = document.getElementById('table');
const logEl = document.getElementById('game-log');
const gameRoomTitle = document.getElementById('game-room-title');
const gameWarning = document.getElementById('game-warning');

let currentUser = null;
let currentRoom = null;
let activePlayers = [];
let selectedCards = new Set();
let socket = null;

function show(view) {
  Object.values(views).forEach((el) => el.classList.add('hidden'));
  views[view].classList.remove('hidden');
}

function setUser(name) {
  currentUser = name;
  userBar.textContent = name ? `当前用户：${name}` : '';
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || '请求失败');
    err.data = data;
    throw err;
  }
  return data;
}

function modeValue() {
  const checked = document.querySelector('input[name="mode"]:checked');
  return checked ? checked.value : 'tractor';
}

async function handleLogin(registerMode = false) {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  if (!username || !password) {
    loginMessage.textContent = '请输入用户名与密码';
    return;
  }
  const path = registerMode ? '/api/register' : '/api/login';
  try {
    const result = await api(path, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    loginMessage.textContent = result.message;
    setUser(username);
    show('home');
    refreshRooms();
  } catch (err) {
    loginMessage.textContent = err.message;
  }
}

async function refreshRooms() {
  const mode = modeValue();
  const data = await api(`/api/rooms?mode=${mode}`);
  roomListEl.innerHTML = '';
  data.rooms.forEach((room) => {
    const card = document.createElement('div');
    card.className = 'room-card';
    card.innerHTML = `
      <div><strong>房间 ${room.id}</strong> - 模式：${room.mode}</div>
      <div>房主：${room.host}</div>
      <div>人数：${room.players.length}</div>
      <button data-join="${room.id}">加入</button>
    `;
    card.querySelector('button').addEventListener('click', () => joinRoom(room.id));
    roomListEl.appendChild(card);
  });
}

async function createRoom() {
  if (!currentUser) return;
  const mode = modeValue();
  const data = await api('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ username: currentUser, mode }),
  });
  enterRoom(data.room.id, data.room, data.warning);
}

async function joinRoom(roomId) {
  if (!currentUser) return;
  const data = await api(`/api/rooms/${roomId}/join`, {
    method: 'POST',
    body: JSON.stringify({ username: currentUser }),
  });
  enterRoom(roomId, data.room);
}

function enterRoom(id, roomData, warning) {
  currentRoom = { id, ...roomData };
  roomTitle.textContent = `房间 ${id} - 模式：${roomData.mode}`;
  roomWarning.textContent = warning || '';
  renderPlayers(roomData);
  connectSocket();
  show('room');
}

function renderPlayers(roomData) {
  playerListEl.innerHTML = '';
  (roomData.players || []).forEach((p) => {
    const tag = document.createElement('div');
    tag.className = 'player-tag';
    tag.innerHTML = `
      <div class="player-avatar" style="background:${p.color}"></div>
      <div>${p.name}</div>
      <div class="badge ${p.ready ? 'ready' : 'waiting'}">${p.ready ? '已准备' : '未准备'}</div>
      <div class="badge">分数：${p.score}</div>
    `;
    playerListEl.appendChild(tag);
  });
}

async function toggleReady() {
  if (!currentRoom) return;
  const me = (currentRoom.players || []).find((p) => p.name === currentUser);
  const ready = !(me && me.ready);
  const data = await api(`/api/rooms/${currentRoom.id}/ready`, {
    method: 'POST',
    body: JSON.stringify({ username: currentUser, ready }),
  });
  currentRoom = data.room;
  renderPlayers(currentRoom);
}

async function startGame() {
  if (!currentRoom) return;
  try {
    const result = await api(`/api/rooms/${currentRoom.id}/start`, {
      method: 'POST',
      body: JSON.stringify({ username: currentUser }),
    });
    handleGameStart(result);
  } catch (err) {
    if (err.data && err.data.needsSelection) {
      const data = err.data;
      selectionPanel.classList.remove('hidden');
      selectionPanel.innerHTML = '<h4>选择进入本局的玩家</h4>';
      data.readyPlayers.forEach((name) => {
        const checkbox = document.createElement('label');
        checkbox.innerHTML = `<input type="checkbox" value="${name}" checked /> ${name}`;
        selectionPanel.appendChild(checkbox);
      });
      const info = document.createElement('div');
      info.textContent = `需要选择 ${data.minPlayers}-${data.maxPlayers} 名玩家`;
      selectionPanel.appendChild(info);
      const confirmBtn = document.createElement('button');
      confirmBtn.textContent = '确认';
      confirmBtn.addEventListener('click', () => confirmSelection(data));
      selectionPanel.appendChild(confirmBtn);
      return;
    }
    alert(err.message);
  }
}

async function confirmSelection(data) {
  const chosen = Array.from(selectionPanel.querySelectorAll('input:checked')).map((el) => el.value);
  try {
    const result = await api(`/api/rooms/${currentRoom.id}/start`, {
      method: 'POST',
      body: JSON.stringify({ username: currentUser, selectedPlayers: chosen }),
    });
    handleGameStart(result);
  } catch (err) {
    alert(err.message);
  }
}

function handleGameStart(result) {
  selectionPanel.classList.add('hidden');
  activePlayers = result.activePlayers || [];
  currentRoom = result.room;
  gameRoomTitle.textContent = `房间 ${currentRoom.id} - ${currentRoom.mode}`;
  renderTable();
  updateMyHand();
  log(`已开始，对局座次从 ${result.startSeat} 开始`);
  show('game');
}

function renderTable() {
  tableEl.innerHTML = '';
  const n = activePlayers.length;
  if (!n) return;
  const centerX = tableEl.clientWidth / 2;
  const centerY = tableEl.clientHeight / 2;
  const radius = 180;
  activePlayers.forEach((p, idx) => {
    const angle = ((idx / n) * Math.PI * 2) - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    const seat = document.createElement('div');
    seat.className = 'seat';
    seat.style.left = `${x - 70}px`;
    seat.style.top = `${y - 40}px`;
    seat.innerHTML = `
      <div class="score">得分：${p.score || 0}</div>
      <div class="avatar-square" style="background:${p.color}"></div>
      <div class="name">${p.name}</div>
      <div class="discard-row">弃牌：${(p.discard || []).join(' ')}</div>
      <div class="discard-row">历史：${(p.history || []).join(' ')}</div>
    `;
    tableEl.appendChild(seat);
  });
}

function updateMyHand() {
  myHandEl.innerHTML = '';
  const me = activePlayers.find((p) => p.name === currentUser);
  if (!me) return;
  me.hand.forEach((card) => {
    const el = document.createElement('div');
    el.className = 'card';
    el.textContent = card;
    if (selectedCards.has(card)) {
      el.classList.add('selected');
    }
    el.addEventListener('click', () => {
      if (selectedCards.has(card)) {
        selectedCards.delete(card);
        el.classList.remove('selected');
      } else {
        selectedCards.add(card);
        el.classList.add('selected');
      }
    });
    myHandEl.appendChild(el);
  });
}

function log(text) {
  const time = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.textContent = `[${time}] ${text}`;
  logEl.prepend(line);
}

async function playCards() {
  if (!currentRoom) return;
  const cards = Array.from(selectedCards.values());
  try {
    const result = await api(`/api/rooms/${currentRoom.id}/play`, {
      method: 'POST',
      body: JSON.stringify({ username: currentUser, cards }),
    });
    activePlayers = result.activePlayers;
    currentRoom = result.room;
    selectedCards.clear();
    updateMyHand();
    renderTable();
    log(`出牌：${cards.join(' ')}`);
  } catch (err) {
    alert(err.message);
  }
}

async function askPoint() {
  if (!currentRoom) return;
  try {
    const result = await api(`/api/rooms/${currentRoom.id}/point`, { method: 'POST' });
    activePlayers = result.activePlayers;
    currentRoom = result.room;
    renderTable();
    updateMyHand();
    if (result.ended) {
      alert('牌局结束');
      show('room');
    }
  } catch (err) {
    alert(err.message);
  }
}

function resetSelection() {
  selectedCards.clear();
  updateMyHand();
}

async function leaveRoom() {
  if (!currentRoom) return;
  await api(`/api/rooms/${currentRoom.id}/leave`, {
    method: 'POST',
    body: JSON.stringify({ username: currentUser }),
  });
  currentRoom = null;
  activePlayers = [];
  show('home');
  refreshRooms();
}

async function endGame() {
  if (!currentRoom) return;
  const confirmEnd = confirm('确认结束并关闭房间吗？');
  if (!confirmEnd) return;
  await api(`/api/rooms/${currentRoom.id}/end`, {
    method: 'POST',
    body: JSON.stringify({ username: currentUser, confirm: true }),
  });
  currentRoom = null;
  activePlayers = [];
  show('home');
  refreshRooms();
}

function connectSocket() {
  if (socket) {
    socket.close();
  }
  socket = new WebSocket(`ws://${location.host}`);
  socket.addEventListener('open', () => {
    if (currentRoom) {
      socket.send(JSON.stringify({ type: 'join-room', roomId: currentRoom.id }));
    }
  });
  socket.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'state' && msg.room && msg.room.id === currentRoom?.id) {
      currentRoom = msg.room;
      renderPlayers(currentRoom);
    }
    if (msg.type === 'game-start') {
      activePlayers = msg.activePlayers;
      currentRoom = msg.room;
      renderTable();
      updateMyHand();
      log('服务器广播：游戏开始');
      show('game');
    }
    if (msg.type === 'play') {
      activePlayers = msg.activePlayers;
      currentRoom = msg.room;
      renderTable();
      updateMyHand();
      log(`${msg.player} 出牌：${msg.cards.join(' ')}`);
    }
    if (msg.type === 'point') {
      activePlayers = msg.activePlayers;
      currentRoom = msg.room;
      renderTable();
      updateMyHand();
      if (msg.ended) {
        alert('牌局结束');
        show('room');
      }
    }
    if (msg.type === 'closed') {
      alert(msg.reason || '房间关闭');
      currentRoom = null;
      activePlayers = [];
      show('home');
      refreshRooms();
    }
    if (msg.type === 'redirect' && msg.players.includes(currentUser)) {
      alert('本轮人数已满，您返回主页');
      currentRoom = null;
      activePlayers = [];
      show('home');
      refreshRooms();
    }
  });
}

function wireEvents() {
  document.getElementById('login-btn').addEventListener('click', () => handleLogin(false));
  document.getElementById('register-btn').addEventListener('click', () => handleLogin(true));
  document.getElementById('refresh-rooms').addEventListener('click', refreshRooms);
  document.getElementById('create-room').addEventListener('click', createRoom);
  document.getElementById('ready-toggle').addEventListener('click', toggleReady);
  document.getElementById('start-game').addEventListener('click', startGame);
  document.getElementById('leave-room').addEventListener('click', leaveRoom);
  document.getElementById('play-cards').addEventListener('click', playCards);
  document.getElementById('ask-point').addEventListener('click', askPoint);
  document.getElementById('reset-selection').addEventListener('click', resetSelection);
  document.getElementById('back-to-room').addEventListener('click', () => show('room'));
  document.getElementById('end-game').addEventListener('click', endGame);
}

wireEvents();
