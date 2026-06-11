const isDev = process.env.NODE_ENV === 'development';

const errorHandler = (err, req, res, _next) => {
  if (isDev) {
    console.error(err.stack || err);
  } else {
    console.error(
      JSON.stringify({
        message: err.message,
        name: err.name,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
      })
    );
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(400).json({
      success: false,
      message: `Duplicate value for ${field}`,
    });
  }

  // Mongoose cast error (bad ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: `Invalid ${err.path}` });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Request payload is too large',
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired' });
  }

  const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const exposeMessage = isDev || status < 500;
  const message = exposeMessage ? err.message || 'Server Error' : 'Internal server error';

  res.status(status).json({
    success: false,
    message,
  });
};

module.exports = { errorHandler };
