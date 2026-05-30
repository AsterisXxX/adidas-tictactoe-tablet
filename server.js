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

let isGameConnected = false;
let heartbeatTimeout;

function setGameConnectionState(state) {
  if (isGameConnected !== state) {
    isGameConnected = state;
    console.log(
      isGameConnected ? "🟢 Unity Game Terhubung!" : "🔴 Unity Game Terputus!",
    );

    io.emit("gameStateChanged", isGameConnected);
  }
}

io.on("connection", (socket) => {
  console.log("Tablet terhubung via WebSocket!");

  socket.emit("gameStateChanged", isGameConnected);

  const validateGameConnection = () => {
    if (!isGameConnected) {
      return false;
    }
    return true;
  };

  socket.on("startGame", () => {
    if (validateGameConnection()) oscClient.send("/ui/start", 1);
  });
  socket.on("selectMode", (mode) => {
    if (validateGameConnection()) oscClient.send("/ui/mode", mode);
  });
  socket.on("submitName", (data) => {
    if (validateGameConnection())
      oscClient.send(`/ui/name/${data.player}`, data.name);
  });
  socket.on("gridClick", (index) => {
    if (validateGameConnection()) oscClient.send("/game/grid/click", index);
  });
});

oscServer.on("message", (msg) => {
  const [address, ...args] = msg;

  if (address === "/game/ping") {
    setGameConnectionState(true);

    clearTimeout(heartbeatTimeout);

    heartbeatTimeout = setTimeout(() => {
      setGameConnectionState(false);
    }, 3000);

    return;
  }

  if (address === "/game/updateGrid") {
    io.emit("syncGrid", { index: args[0], side: args[1] });
  }
  if (address === "/game/turn") {
    io.emit("syncTurn", { playerName: args[0] });
  }
  if (address === "/game/over") {
    io.emit("syncGameOver", { winner: args[0] });
  }
});

server.listen(port, () => {
  console.log(`Server web & WebSocket berjalan di http://localhost:${port}`);
  console.log(
    `OSC TX (ke Unity) di port 8000 | OSC RX (dari Unity) di port 8001`,
  );
});
