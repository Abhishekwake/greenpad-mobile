/**
 * Load environment variables from the correct file:
 * - development (default): `.env` in the backend folder
 * - production: `.env.production` when NODE_ENV === 'production'
 *
 * Call once at process startup before any other backend code reads process.env.
 */
const path = require('path');
const dotenv = require('dotenv');

const BACKEND_ROOT = path.join(__dirname, '..');

function loadEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  const filename = isProduction ? '.env.production' : '.env';
  const envPath = path.join(BACKEND_ROOT, filename);

  const result = dotenv.config({ path: envPath });

  if (result.error) {
    if (isProduction) {
      console.warn(`[env] ${filename} not found at ${envPath} — relying on injected environment variables`);
    } else {
      console.warn(`[env] ${filename} not found at ${envPath} — create it from .env.example`);
    }
  } else {
    console.log(`[env] Loaded ${filename}`);
  }
}

module.exports = { loadEnv, BACKEND_ROOT };
