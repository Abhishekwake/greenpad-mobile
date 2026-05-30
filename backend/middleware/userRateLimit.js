const rateLimit = require('express-rate-limit');

function createUserRateLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
    keyGenerator: (req) => {
      if (req.user?._id) {
        return `user:${req.user._id}`;
      }
      return req.ip || 'unknown';
    },
  });
}

const leadCreateLimiter = createUserRateLimiter({
  windowMs: Number(process.env.LEAD_CREATE_RATE_WINDOW_MS) || 24 * 60 * 60 * 1000,
  max: Number(process.env.LEAD_CREATE_RATE_MAX) || 10,
  message: 'Too many site visit bookings. Please try again later.',
});

const redeemLimiter = createUserRateLimiter({
  windowMs: Number(process.env.REDEEM_RATE_WINDOW_MS) || 60 * 60 * 1000,
  max: Number(process.env.REDEEM_RATE_MAX) || 5,
  message: 'Too many redemption attempts. Please try again later.',
});

module.exports = { leadCreateLimiter, redeemLimiter };
