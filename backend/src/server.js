require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { initSchema } = require("./db");

const authRoutes = require("./routes/auth");
const boardsRoutes = require("./routes/boards");
const itemsRoutes = require("./routes/items");
const youtubeRoutes = require("./routes/youtube");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/boards", boardsRoutes);
app.use("/api/items", itemsRoutes);
app.use("/api/youtube", youtubeRoutes);

app.use((err, req, res, next) => {
  console.error(err);
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
