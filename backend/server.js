const { loadEnv } = require('./config/loadEnv');
loadEnv();

const os = require('os');
const express = require('express');

function getLanIPv4() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      const v4 = net.family === 'IPv4' || net.family === 4;
      if (v4 && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}
const cors = require('cors');
const { buildCorsOptions } = require('./config/corsOptions');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');
const seedRewards = require('./utils/seedRewards');
const seedCoinSettings = require('./utils/seedCoinSettings');
const migrateLeadStatuses = require('./utils/migrateLeadStatuses');

const app = express();

// Security
app.use(helmet());
app.use(cors(buildCorsOptions()));

// Rate limiting (relaxed in development)
const isDev = process.env.NODE_ENV === 'development';
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 100,
  message: { success: false, message: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 50 : 3,
  message: { success: false, message: 'Too many OTP requests. Wait 1 minute.' },
});

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health checks (root for load balancers; /api for existing clients)
function healthPayload() {
  return {
    status: 'ok',
    service: 'greenpad-api',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  };
}
app.get('/health', (_req, res) => {
  res.json(healthPayload());
});
app.get('/api/health', (_req, res) => {
  res.json(healthPayload());
});

// Routes
app.use('/api/auth', otpLimiter, require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/referral', require('./routes/referral'));
app.use('/api/lead', require('./routes/lead'));
app.use('/api/rewards', require('./routes/rewards'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/videos', require('./routes/videos'));

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// Start
const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  await migrateLeadStatuses();
  await seedRewards();
  await seedCoinSettings();
  app.listen(PORT, '0.0.0.0', () => {
    const lan = getLanIPv4();
    console.log(`Server running in ${process.env.NODE_ENV} on port ${PORT}`);
    console.log(`Health: http://localhost:${PORT}/health  (and /api/health)`);
    if (lan) {
      console.log(`Network (phones): http://${lan}:${PORT}/health`);
    }
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
