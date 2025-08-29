function assignSeats(clients) {
    clients.forEach((c, i) => c.seat = i); // 顺序分配座次
}

function dealCards(clients, min = 1, max = 10) {
    clients.forEach(c => {
        c.hand = [randomCard(), randomCard()];
    });
}

function randomCard() {
    return Math.floor(Math.random() * 256);
}

function start(clients) {
    assignSeats(clients);
    dealCards(clients, 1, 10);

    clients.forEach(c => {
        c.send(JSON.stringify({
                event: "hand",
                seat: c.seat,
                hand: c.hand
        }));
    });
}

module.exports = { start };
