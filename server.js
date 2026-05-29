const express = require("express");
const { Client } = require("node-osc");
const path = require("path");

const app = express();
const port = 3000;

// Konfigurasi OSC Client: Mengirim data ke IP PC ini (localhost) di port 8000
// (Nanti di Unity, script OSC receiver-nya harus mendengarkan di port 8000)
const oscClient = new Client("127.0.0.1", 8000);

// Setup EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware untuk membaca JSON dari request body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route utama untuk render halaman EJS
app.get("/", (req, res) => {
  res.render("index");
});

// ==========================================
// REST API ENDPOINTS (Tablet -> Node -> OSC)
// ==========================================

app.post("/api/start", (req, res) => {
  oscClient.send("/ui/start", 1);
  res.json({ status: "success", message: "Trigger Start Game" });
});

app.post("/api/mode", (req, res) => {
  // Mode bisa boolean: 0 untuk 1P (Bot), 1 untuk 2P
  const mode = req.body.mode;
  oscClient.send("/ui/mode", mode);
  res.json({ status: "success", message: `Trigger Mode: ${mode}` });
});

app.post("/api/name", (req, res) => {
  const { player, name } = req.body;
  // Mengirim string nama ke address spesifik player
  oscClient.send(`/ui/name/${player}`, name);
  res.json({
    status: "success",
    message: `Name ${name} sent for Player ${player}`,
  });
});

app.post("/api/leaderboard", (req, res) => {
  oscClient.send("/ui/leaderboard", 1);
  res.json({ status: "success", message: "Trigger Leaderboard" });
});

app.post("/api/ads", (req, res) => {
  oscClient.send("/ui/ads", 1);
  res.json({ status: "success", message: "Trigger Ads" });
});

app.listen(port, () => {
  console.log(`Server web berjalan di http://localhost:${port}`);
  console.log(`OSC Client siap mengirim ke Unity di port 8000`);
});
