const express = require("express");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, "urls.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    original_url TEXT NOT NULL,
    clicks INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function generateCode(length = 6) {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

app.post("/api/shorten", (req, res) => {
  const { url } = req.body;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: "URL inválida" });
  }

  let code = generateCode();
  const insert = db.prepare("INSERT INTO urls (code, original_url) VALUES (?, ?)");

  let attempts = 0;
  while (attempts < 5) {
    try {
      insert.run(code, url);
      break;
    } catch {
      code = generateCode();
      attempts++;
    }
  }

  res.json({ code, shortUrl: `${req.protocol}://${req.get("host")}/${code}` });
});

app.get("/api/stats/:code", (req, res) => {
  const row = db.prepare("SELECT code, original_url, clicks, created_at FROM urls WHERE code = ?").get(req.params.code);

  if (!row) {
    return res.status(404).json({ error: "Código não encontrado" });
  }

  res.json(row);
});

app.get("/:code", (req, res) => {
  const row = db.prepare("SELECT original_url FROM urls WHERE code = ?").get(req.params.code);

  if (!row) {
    return res.status(404).send("Link não encontrado");
  }

  db.prepare("UPDATE urls SET clicks = clicks + 1 WHERE code = ?").run(req.params.code);
  res.redirect(row.original_url);
});

app.listen(PORT, () => {
  console.log(`Encurtador de URL rodando em http://localhost:${PORT}`);
});
