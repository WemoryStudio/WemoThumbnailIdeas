const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS boards (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      video_id TEXT NOT NULL,
      title TEXT,
      channel_title TEXT,
      channel_id TEXT,
      channel_avatar TEXT,
      view_count BIGINT,
      subscriber_count BIGINT,
      published_at TIMESTAMPTZ,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      added_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id SERIAL PRIMARY KEY,
      slot INTEGER UNIQUE NOT NULL,
      key_value TEXT NOT NULL,
      used_count INTEGER NOT NULL DEFAULT 0,
      quota_day TEXT,
      exhausted BOOLEAN NOT NULL DEFAULT false
    );
  `);
}

module.exports = { pool, initSchema };
