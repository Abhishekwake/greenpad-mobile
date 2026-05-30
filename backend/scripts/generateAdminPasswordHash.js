#!/usr/bin/env node
/**
 * Generate bcrypt hash for ADMIN_PASSWORD_HASH env var.
 * Usage: node scripts/generateAdminPasswordHash.js [password]
 */
const bcrypt = require('bcryptjs');

const password = process.argv[2] || process.env.ADMIN_PASSWORD || 'admin123';
const hash = bcrypt.hashSync(password, 10);

console.log('Add to backend/.env:');
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
console.log('');
console.log('Remove or unset ADMIN_PASSWORD in production after setting the hash.');
