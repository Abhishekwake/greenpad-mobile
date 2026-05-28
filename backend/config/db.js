const mongoose = require('mongoose');
const dns = require('dns');

/**
 * Windows / some routers fail Node's SRV lookup for mongodb+srv while nslookup works.
 * Use public resolvers so Atlas `mongodb+srv://` URIs connect reliably in dev.
 */
if (process.platform === 'win32' && String(process.env.MONGODB_URI || '').startsWith('mongodb+srv://')) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

/**
 * Connect to MongoDB (local or Atlas). Set `MONGODB_URI` in `.env` / `.env.production`.
 * Atlas example: mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/greenpad?retryWrites=true&w=majority
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MongoDB connection error: MONGODB_URI is not set');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15_000,
      maxPoolSize: 10,
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
