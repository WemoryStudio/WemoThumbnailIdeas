const rateLimit = require("express-rate-limit");

// Login/register: slows down password-guessing and mass account creation.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a few minutes." },
});

// YouTube search/trending: the API key pool is shared by every user of the
// app now (it used to be each user's own key), so one user hammering search
// can burn the whole day's quota for everyone else. Keyed by user id (set by
// requireAuth, which runs before this in youtube.js) rather than IP, so it
// throttles per-account instead of per-network.
const youtubeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.userId ? String(req.userId) : req.ip),
  message: { error: "Too many searches — please wait a few minutes before searching again." },
});

module.exports = { authLimiter, youtubeLimiter };
