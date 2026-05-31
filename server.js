const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Client, Server: OSCServer } = require("node-osc");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = 3000;

const oscClient = new Client("127.0.0.1", 8000);
const oscServer = new OSCServer(8001, "127.0.0.1");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));

const uploadDir = "C:/ads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    fs.readdir(uploadDir, (err, files) => {
      if (!err) {
        files.forEach((f) => {
          if (f.toLowerCase().endsWith(".mp4")) {
            try {
              fs.unlinkSync(path.join(uploadDir, f));
            } catch (e) {
              console.error("Gagal menghapus file lama:", e);
            }
          }
        });
      }
      cb(null, uploadDir);
    });
  },
  filename: function (req, file, cb) {
    cb(null, "video_iklan.mp4");
  },
});
const upload = multer({ storage: storage });

let isGameConnected = false;
let heartbeatTimeout;
let activeTabletSocketId = null;

let isLoopingAdsActive = false;

function setGameConnectionState(state) {
  if (isGameConnected !== state) {
    isGameConnected = state;
    console.log(
      isGameConnected ? "🟢 Unity Game Terhubung!" : "🔴 Unity Game Terputus!",
    );
    io.emit("gameStateChanged", isGameConnected);
  }
}

app.post("/upload", upload.single("videoFile"), (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "Tidak ada file yang diunggah." });
  }

  console.log(`Berhasil mengunggah video: ${req.file.filename}`);
  res.json({
    success: true,
    message: "Upload berhasil!",
    filename: req.file.filename,
  });
});

app.get("/", (req, res) => {
  res.render("index");
});

io.on("connection", (socket) => {
  if (activeTabletSocketId !== null) {
    console.log(`[BLOCKED] Perangkat asing mencoba masuk (${socket.id}).`);
    socket.emit("gameOfflineError", {
      message: "Sudah ada tablet yang mengontrol game ini.",
    });
    socket.disconnect(true);
    return;
  }

  activeTabletSocketId = socket.id;
  console.log(`📱 Tablet SAH terhubung! (ID: ${socket.id})`);

  oscClient.send("/ui/connection", 1);
  socket.emit("gameStateChanged", isGameConnected);

  socket.emit("syncLoopState", isLoopingAdsActive);

  const validateGameConnection = () => {
    if (!isGameConnected) return false;
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
  socket.on("resetGame", () => {
    if (validateGameConnection()) oscClient.send("/ui/reset", 1);
  });
  socket.on("showLeaderboard", () => {
    if (validateGameConnection()) oscClient.send("/ui/showleaderboard", 1);
  });

  socket.on("toggleLoop", () => {
    if (validateGameConnection()) {
      isLoopingAdsActive = !isLoopingAdsActive;

      oscClient.send("/ui/switchloop", isLoopingAdsActive ? 1 : 0);

      io.emit("syncLoopState", isLoopingAdsActive);
    }
  });

  socket.on("disconnect", () => {
    if (activeTabletSocketId === socket.id) {
      console.log(`📱 Tablet terputus! (ID: ${socket.id})`);
      activeTabletSocketId = null;
      oscClient.send("/ui/connection", 0);
    }
  });
});

oscServer.on("message", (msg) => {
  const [address, ...args] = msg;

  if (address === "/game/interactable") {
    const isInteractable = args[0] === 1;
    io.emit("syncInteractable", isInteractable);
  }

  if (address === "/game/ping") {
    setGameConnectionState(true);

    if (activeTabletSocketId != null) {
      oscClient.send("/ui/connection", 1);
    } else {
      oscClient.send("/ui/connection", 0);
    }

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
  if (address === "/game/mainmenu") {
    io.emit("backtohome");
  }
});

server.listen(port, () => {
  console.log(`Server web & WebSocket berjalan di http://localhost:${port}`);
});
