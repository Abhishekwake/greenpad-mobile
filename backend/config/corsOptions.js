/**
 * CORS configuration for Express.
 *
 * - `CORS_ORIGIN` unset or `*`: allow any origin (OK for early dev; tighten for production).
 * - Otherwise: comma-separated list of allowed origins, e.g.
 *   `https://admin.example.com,https://www.example.com`
 */
function buildCorsOptions() {
  const raw = process.env.CORS_ORIGIN?.trim();

  if (!raw || raw === '*') {
    return {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    };
  }

  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) {
    return {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    };
  }

  return {
    origin(origin, callback) {
      // Mobile apps / curl may send no Origin
      if (!origin) {
        callback(null, true);
        return;
      }
      if (list.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  };
}

module.exports = { buildCorsOptions };
