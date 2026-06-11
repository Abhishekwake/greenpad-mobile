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
const seedWorkflow = require('./utils/seedWorkflow');
const migrateLeadStatuses = require('./utils/migrateLeadStatuses');
const migrateTransactionMilestones = require('./utils/migrateTransactionMilestones');
const migrateCoinSettingsFields = require('./utils/migrateCoinSettingsFields');
const seedAdminAccounts = require('./utils/seedAdminAccounts');
const reconcileCoins = require('./jobs/reconcileCoins');

const app = express();

// Render / reverse proxies set X-Forwarded-For. Required for correct req.ip and so
// express-rate-limit does not throw ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set('trust proxy', 1);

// Security
app.use(helmet());
app.use(cors(buildCorsOptions()));

// Rate limiting (relaxed in development). Must run after trust proxy.
const isDev = process.env.NODE_ENV === 'development';
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

const otpMaxRaw = process.env.OTP_RATE_LIMIT_MAX;
const otpMaxProd =
  otpMaxRaw !== undefined && otpMaxRaw !== '' && Number.isFinite(Number(otpMaxRaw)) && Number(otpMaxRaw) > 0
    ? Math.min(100, Math.floor(Number(otpMaxRaw)))
    : 15;

const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 50 : otpMaxProd,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OTP requests. Wait 1 minute.' },
});

// Body parsing — workflow templates and admin config can exceed 10kb; uploads use base64 JSON.
function jsonBodyLimitFor(req) {
  const path = req.path || '';
  const isUpload =
    path === '/api/project/upload' ||
    path === '/api/admin/upload' ||
    /^\/api\/project\/[^/]+\/stage\/[^/]+\/document$/.test(path);
  return isUpload ? '15mb' : '1mb';
}

app.use((req, res, next) => {
  express.json({ limit: jsonBodyLimitFor(req) })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

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
app.use('/api/settings', require('./routes/settings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/project', require('./routes/project'));
app.use('/api/videos', require('./routes/videos'));
app.use('/api/upload', require('./routes/upload'));

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
  await migrateTransactionMilestones();
  await migrateCoinSettingsFields();
  await seedAdminAccounts();
  await seedRewards();
  await seedCoinSettings();
  await seedWorkflow();

  if (process.env.ENABLE_RECONCILE_CRON !== 'false') {
    try {
      const cron = require('node-cron');
      const schedule = process.env.RECONCILE_CRON_SCHEDULE || '0 3 * * *';
      cron.schedule(schedule, () => {
        reconcileCoins().catch((err) => console.error('[cron] reconcile failed:', err));
      });
      console.log(`[cron] Coin reconciliation scheduled: ${schedule}`);
    } catch (err) {
      console.warn('[cron] node-cron not available — reconciliation cron disabled');
    }
  }

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
