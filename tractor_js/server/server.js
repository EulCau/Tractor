const WebSocket = require("ws");
const gameManager = require("./gameManager");

const wss = new WebSocket.Server({ port: 8080 });

const gameModes = {
    tractor: { name: "拖拉机", minPlayers: 4, maxPlayers: 6 },
    holdem: { name: "德州扑克", minPlayers: 2, maxPlayers: 9 },
    test: { name: "测试", minPlayers: 1, maxPlayers: 4 },
};

let rooms = {};
for (let mode in gameModes) {
    rooms[mode] = {players: [], ready: [], starter: null};
}

wss.on("connection", (ws) => {
    ws.send(JSON.stringify({
        event: "modes",
        modes: gameModes
    }));
    ws.on("message", (msg) => {
        const data = JSON.parse(msg);
        const mode = data.mode;

        if (data.type === "get_modes") {
            ws.send(JSON.stringify({
                event: "modes",
                modes: gameModes
            }));
            return;
        }

        if (!gameModes[mode]) {
            ws.send(JSON.stringify({ event: "error", msg: `无效的游戏模式: ${mode}` }));
            return;
        }

        if (data.type === "join") {
            ws.username = data.username;
            rooms[mode].players.push(ws);
            broadcast(mode);
        }

        if (data.type === "ready") {
            if (!rooms[mode].ready.includes(ws.username)) {
                rooms[mode].ready.push(ws.username);
                if (!rooms[mode].starter) {
                    rooms[mode].starter = ws.username; // 第一个准备的人
                }
            }
            broadcast(mode);
        }

        if (data.type === "start") {
            const config = gameModes[mode];
            const room = rooms[mode];

            // 只有 starter 能点开始
            if (ws.username !== room.starter) {
                ws.send(JSON.stringify({ event: "error", msg: "只有第一个准备的人能开始游戏" }));
                return;
            }

            let selectedPlayers = room.players.filter(p => room.ready.includes(p.username));
            if (data.selectedUsernames) {
                selectedPlayers = selectedPlayers.filter(p => data.selectedUsernames.includes(p.username));
            }

            if (selectedPlayers.length >= config.minPlayers &&
                selectedPlayers.length <= config.maxPlayers) {
                gameManager.startGame(mode, selectedPlayers, () => {
                    broadcast(mode, {
                        event: "game_start",
                        msg: `游戏开始: ${selectedPlayers.map(p => p.username).join(", ")}`
                    });
                });
            } else {
                ws.send(JSON.stringify({
                    event: "error",
                    msg: `人数不符合要求 (${config.minPlayers}-${config.maxPlayers})`
                }));
            }
        }
    });

    ws.on("close", () => {
        for (let mode in rooms) {
            rooms[mode].players = rooms[mode].players.filter((p) => p !== ws);
            rooms[mode].ready = rooms[mode].ready.filter((p) => p !== ws);
            if (rooms[mode].starter === ws) rooms[mode].starter = null;
            broadcast(mode);
        }
    });
});

function broadcast(mode, extra = {}) {
    const room = rooms[mode];
    const message = {
        event: "update",
        players: room.players.map(p => p.username),
        ready: room.ready,
        starter: room.starter ? room.starter.username : null,
        ...extra,
    };
    room.players.forEach((p) => p.send(JSON.stringify(message)));
}

console.log("服务器运行在 ws://localhost:8080");
