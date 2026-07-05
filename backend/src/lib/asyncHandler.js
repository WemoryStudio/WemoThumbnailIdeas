// Wraps an async route handler so a thrown/rejected error is forwarded to
// Express's error middleware instead of becoming an unhandled rejection,
// which would otherwise crash the whole process (Node terminates on
// unhandled promise rejections by default).
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
