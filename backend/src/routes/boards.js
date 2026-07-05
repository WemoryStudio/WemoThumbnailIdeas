const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../lib/asyncHandler");

const router = express.Router();
router.use(requireAuth);

// Board ids are numeric (SERIAL) - reject anything else before it ever
// reaches a query, instead of letting Postgres throw a type-cast error.
function isValidId(id) {
  return /^\d+$/.test(String(id));
}

// Confirms a board belongs to the logged-in user before letting them touch it.
async function loadOwnedBoard(boardId, userId) {
  if (!isValidId(boardId)) return null;
  const { rows } = await pool.query(`SELECT * FROM boards WHERE id = $1 AND user_id = $2`, [boardId, userId]);
  return rows[0] || null;
}

router.get("/", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM boards WHERE user_id = $1 ORDER BY created_at ASC`,
    [req.userId]
  );
  res.json({ boards: rows });
}));

router.post("/", asyncHandler(async (req, res) => {
  const name = (req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Board name is required." });

  const { rows } = await pool.query(
    `INSERT INTO boards (user_id, name) VALUES ($1, $2) RETURNING *`,
    [req.userId, name]
  );
  res.status(201).json({ board: rows[0] });
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const board = await loadOwnedBoard(req.params.id, req.userId);
  if (!board) return res.status(404).json({ error: "Board not found." });

  const name = (req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Board name is required." });

  const { rows } = await pool.query(`UPDATE boards SET name = $1 WHERE id = $2 RETURNING *`, [name, board.id]);
  res.json({ board: rows[0] });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const board = await loadOwnedBoard(req.params.id, req.userId);
  if (!board) return res.status(404).json({ error: "Board not found." });

  await pool.query(`DELETE FROM boards WHERE id = $1`, [board.id]);
  res.status(204).end();
}));

// Save a thumbnail into a board.
router.post("/:id/items", asyncHandler(async (req, res) => {
  const board = await loadOwnedBoard(req.params.id, req.userId);
  if (!board) return res.status(404).json({ error: "Board not found." });

  const {
    videoId, title, channelTitle, channelId, channelAvatar,
    viewCount, subscriberCount, publishedAt, tags,
  } = req.body || {};
  if (!videoId) return res.status(400).json({ error: "videoId is required." });

  const { rows } = await pool.query(
    `INSERT INTO items
       (board_id, video_id, title, channel_title, channel_id, channel_avatar,
        view_count, subscriber_count, published_at, tags)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      board.id, videoId, title || null, channelTitle || null, channelId || null,
      channelAvatar || null, viewCount ?? null, subscriberCount ?? null,
      publishedAt || null, JSON.stringify(tags || []),
    ]
  );
  res.status(201).json({ item: rows[0] });
}));

module.exports = router;
