require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { initSchema } = require("./db");

const authRoutes = require("./routes/auth");
const boardsRoutes = require("./routes/boards");
const itemsRoutes = require("./routes/items");
const youtubeRoutes = require("./routes/youtube");

const app = express();

// Render (and most hosts) sit behind a reverse proxy - without this, every
// request looks like it comes from the proxy's IP, which breaks per-IP rate
// limiting and makes express-rate-limit refuse to start.
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/boards", boardsRoutes);
app.use("/api/items", itemsRoutes);
app.use("/api/youtube", youtubeRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Catches anything thrown/rejected in a route (see lib/asyncHandler.js) so a
// bad request can never crash the whole process - it was previously possible
// for a single malformed request (e.g. a non-numeric board id) to take the
// entire backend down for every user, since Node terminates on unhandled
// promise rejections by default.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const port = process.env.PORT || 3000;

initSchema()
  .then(() => {
    app.listen(port, () => console.log(`WEMORY backend listening on port ${port}`));
  })
  .catch((err) => {
    console.error("Failed to initialize database schema:", err);
    process.exit(1);
  });
