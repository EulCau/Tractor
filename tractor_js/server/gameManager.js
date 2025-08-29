const testGame = require("./games/testGame");
// const tractor = require("./games/tractor");
// const texas = require("./games/texas");

function startGame(gameType, clients, broadcastPlayers) {
    switch (gameType) {
        case "test":
            testGame.start(clients);
            broadcastPlayers();
            break;
        // case "tractor":
        //   tractor.start(clients);
        //   broadcastPlayers();
        //   break;
        // case "texas":
        //   texas.start(clients);
        //   broadcastPlayers();
        //   break;
        default:
            console.log("未知游戏类型:", gameType);
    }
}

module.exports = { startGame };
