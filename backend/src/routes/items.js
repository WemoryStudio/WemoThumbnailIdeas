const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../lib/asyncHandler");

const router = express.Router();
router.use(requireAuth);

function isValidId(id) {
  return /^\d+$/.test(String(id));
}

// All saved items across all of the user's boards - used for dedupe / "saved" checks.
router.get("/", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT items.* FROM items
     JOIN boards ON boards.id = items.board_id
     WHERE boards.user_id = $1
     ORDER BY items.added_at DESC`,
    [req.userId]
  );
  res.json({ items: rows });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(404).json({ error: "Item not found." });

  const { rows } = await pool.query(
    `DELETE FROM items USING boards
     WHERE items.id = $1 AND items.board_id = boards.id AND boards.user_id = $2
     RETURNING items.id`,
    [req.params.id, req.userId]
  );
  if (!rows.length) return res.status(404).json({ error: "Item not found." });
  res.status(204).end();
}));

// Remove every saved copy of a given YouTube video across all the user's boards.
router.delete("/by-video/:videoId", asyncHandler(async (req, res) => {
  await pool.query(
    `DELETE FROM items USING boards
     WHERE items.board_id = boards.id AND boards.user_id = $1 AND items.video_id = $2`,
    [req.userId, req.params.videoId]
  );
  res.status(204).end();
}));

module.exports = router;
