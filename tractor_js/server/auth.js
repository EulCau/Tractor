// 简单模拟用户系统（以后可换数据库）
const {readFileSync} = require("node:fs");
let usersDB = {}; // username -> password
try { usersDB = JSON.parse(readFileSync("users.json")); } catch {}

function verifyUser(username, password) {
    return usersDB[username] && usersDB[username] === password;
}

module.exports = { verifyUser };
