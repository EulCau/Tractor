import { useState, useEffect } from "react";

export default function App() {
    const [ws, setWs] = useState(null);
    const [username, setUsername] = useState("");
    const [loggedIn, setLoggedIn] = useState(false);

    const [mode, setMode] = useState(null);
    const [players, setPlayers] = useState([]);
    const [ready, setReady] = useState([]);
    const [starter, setStarter] = useState(null);

    const [messages, setMessages] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [modes, setModes] = useState({});

    useEffect(() => {
        const socket = new WebSocket("ws://localhost:8080");
        setWs(socket);

        socket.onopen = () => {
            socket.send(JSON.stringify({ type: "get_modes" }));
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.event === "modes") {
                console.log("收到 modes:", data.modes);
                setModes(data.modes);
            }
            if (data.event === "update") {
                setPlayers(data.players);
                setReady(data.ready);
                setStarter(data.starter);
            }
            if (data.event === "game_start") {
                setMessages((m) => [...m, data.msg]);
            }
            if (data.event === "error") {
                setMessages((m) => [...m, "❌ " + data.msg]);
            }
            if (data.event === "hand") {
                setMessages((m) => [...m, `🎴 你的手牌: ${data.hand.join(", ")}`]);
            }
        };

        return () => socket.close();
    }, []);

    // 登录
    const handleLogin = () => {
        if (username.trim()) setLoggedIn(true);
    };

    // 加入房间
    const joinGame = (mode) => {
        setMode(mode);
        ws.send(JSON.stringify({ type: "join", mode, username }));
    };

    const readyUp = () => {
        ws.send(JSON.stringify({ type: "ready", mode }));
    };

    const startGame = () => {
        ws.send(JSON.stringify({ type: "start", mode, selectedUsernames: selectedUsers }));
    };

    // 登录界面
    if (!loggedIn) {
        return (
            <div className="p-4">
                <h1 className="text-xl font-bold">登录</h1>
                <input
                    className="border p-2"
                    placeholder="输入用户名"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
                <button
                    className="ml-2 p-2 bg-blue-500 text-white rounded"
                    onClick={handleLogin}
                >
                    确认
                </button>
            </div>
        );
    }

    // 选择游戏模式
    if (!mode) {
        return (
            <div className="p-4">
                <h1 className="text-xl font-bold">选择游戏模式</h1>
                {Object.entries(modes).map(([key, cfg]) => (
                    <button
                        key={key}
                        className="m-2 p-2 bg-blue-500 text-white rounded"
                        onClick={() => joinGame(key)}
                    >
                    {cfg.name} ({cfg.minPlayers}-{cfg.maxPlayers}人)
                    </button>
                ))}
            </div>
        );
    }

    // 房间界面
    return (
        <div className="p-4">
            <h1 className="text-xl font-bold">
                当前模式：{modes[mode]?.name || mode}
            </h1>
            <p>
                房间人数：{players.length}
            </p>
            <p>
                准备人数：{ready.length} （要求 {modes[mode]?.minPlayers}-{modes[mode]?.maxPlayers} 人）
            </p>

            {!ready.includes(username) && (
                <button
                    className="m-2 p-2 bg-yellow-500 text-white rounded"
                    onClick={readyUp}
                >
                    准备
                </button>
            )}

            {/* starter 才能看到开始按钮 */}
            {starter === username && ready.includes(username) && (
                <div className="mt-2">
                    <h2 className="font-bold">开始游戏控制</h2>
                    {/* 如果人数超员，显示选择框 */}
                    {ready.length > (modes[mode]?.maxPlayers || 10) && (
                        <div>
                            <p>选择参与的玩家：</p>
                            {ready.map((u) => (
                                <label key={u} className="block">
                                    <input
                                        type="checkbox"
                                        checked={selectedUsers.includes(u)}
                                        onChange={() =>
                                            setSelectedUsers((prev) =>
                                                prev.includes(u)
                                                    ? prev.filter((x) => x !== u)
                                                    : [...prev, u]
                                            )
                                        }
                                    />
                                    {u}
                                </label>
                            ))}
                        </div>
                    )}

                    <button
                        className="mt-2 p-2 bg-red-500 text-white rounded"
                        onClick={startGame}
                    >
                        开始游戏
                    </button>
                </div>
            )}

            <div className="mt-4">
                <h2 className="font-bold">玩家列表</h2>
                {players.map((u) => (
                    <p key={u}>
                        {u} {ready.includes(u) ? "✅ 已准备" : "⌛ 未准备"}{" "}
                        {starter === u && "👑"}
                    </p>
                ))}
            </div>

            <div className="mt-4">
                <h2 className="font-bold">消息</h2>
                {messages.map((m, i) => (
                    <p key={i}>{m}</p>
                ))}
            </div>
        </div>
    );
}
