const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Client, Server: OSCServer } = require("node-osc");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = 3000;

const oscClient = new Client("127.0.0.1", 8000);
const oscServer = new OSCServer(8001, "127.0.0.1");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("index");
});

io.on("connection", (socket) => {
  console.log("Tablet terhubung via WebSocket!");

  socket.on("startGame", () => oscClient.send("/ui/start", 1));
  socket.on("selectMode", (mode) => oscClient.send("/ui/mode", mode));
  socket.on("submitName", (data) =>
    oscClient.send(`/ui/name/${data.player}`, data.name),
  );

  socket.on("gridClick", (index) => oscClient.send("/game/grid/click", index));
});

oscServer.on("message", (msg) => {
  const [address, ...args] = msg;

  console.log(`[OSC IN] Address: ${address} | Args:`, args);

  if (address === "/game/updateGrid") {
    console.log(
      `---> Mengirim ke Tablet: syncGrid (Index: ${args[0]}, Side: ${args[1]})`,
    );
    io.emit("syncGrid", { index: args[0], side: args[1] });
  }

  if (address === "/game/turn") {
    console.log(`---> Mengirim ke Tablet: syncTurn (Player: ${args[0]})`);
    io.emit("syncTurn", { playerName: args[0] });
  }

  if (address === "/game/over") {
    console.log(`---> Mengirim ke Tablet: syncGameOver (Winner: ${args[0]})`);
    io.emit("syncGameOver", { winner: args[0] });
  }
});

server.listen(port, () => {
  console.log(`Server web & WebSocket berjalan di http://localhost:${port}`);
  console.log(
    `OSC TX (ke Unity) di port 8000 | OSC RX (dari Unity) di port 8001`,
  );
});
