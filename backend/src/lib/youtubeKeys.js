const { pool } = require("../db");

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Makes sure the api_keys table has one row per YT_API_KEY_1/2/3 env var.
async function ensureKeysSeeded() {
  const envKeys = [process.env.YT_API_KEY_1, process.env.YT_API_KEY_2, process.env.YT_API_KEY_3];
  for (let slot = 0; slot < envKeys.length; slot++) {
    const value = envKeys[slot];
    if (!value) continue;
    await pool.query(
      `INSERT INTO api_keys (slot, key_value, used_count, quota_day, exhausted)
       VALUES ($1, $2, 0, $3, false)
       ON CONFLICT (slot) DO UPDATE SET key_value = EXCLUDED.key_value`,
      [slot, value, todayStr()]
    );
  }
}

// Resets a key's quota flag once a new day starts.
async function resetIfNewDay(row) {
  if (row.quota_day === todayStr()) return row;
  const { rows } = await pool.query(
    `UPDATE api_keys SET used_count = 0, quota_day = $2, exhausted = false WHERE id = $1 RETURNING *`,
    [row.id, todayStr()]
  );
  return rows[0];
}

// Picks the first non-exhausted key (lowest slot first), like the client's auto-rotation.
async function pickActiveKey() {
  const { rows } = await pool.query(`SELECT * FROM api_keys ORDER BY slot ASC`);
  for (let row of rows) {
    row = await resetIfNewDay(row);
    if (!row.exhausted) return row;
  }
  return null;
}

async function markExhausted(keyId) {
  await pool.query(`UPDATE api_keys SET exhausted = true WHERE id = $1`, [keyId]);
}

async function bumpUsage(keyId, units) {
  await pool.query(`UPDATE api_keys SET used_count = used_count + $2 WHERE id = $1`, [keyId, units]);
}

function looksLikeQuotaError(body) {
  const message = JSON.stringify(body || {});
  return /quota/i.test(message);
}

// Fetches a YouTube Data API URL (without the key), trying each available
// key in turn until one works or all are exhausted for the day.
async function fetchYoutube(urlWithoutKey, quotaUnits) {
  await ensureKeysSeeded();

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const key = await pickActiveKey();
    if (!key) throw new Error("All YouTube API keys have hit their daily quota.");

    const resp = await fetch(`${urlWithoutKey}&key=${encodeURIComponent(key.key_value)}`);
    const data = await resp.json();

    if (resp.ok) {
      await bumpUsage(key.id, quotaUnits);
      return data;
    }

    if (resp.status === 403 && looksLikeQuotaError(data.error)) {
      await markExhausted(key.id);
      lastError = data;
      continue; // try the next key
    }

    // Non-quota error (bad request, invalid key, etc.) - don't keep retrying.
    const err = new Error(data.error?.message || "YouTube API request failed");
    err.status = resp.status;
    throw err;
  }

  const err = new Error("All YouTube API keys have hit their daily quota.");
  err.status = 429;
  err.details = lastError;
  throw err;
}

module.exports = { fetchYoutube };
