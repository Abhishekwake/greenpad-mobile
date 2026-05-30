const bcrypt = require('bcryptjs');
const AdminAccount = require('../models/AdminAccount');

/**
 * Creates first super_admin from env when no AdminAccount rows exist.
 */
async function seedAdminAccounts() {
  const count = await AdminAccount.countDocuments();
  if (count > 0) {
    return;
  }

  const email = (process.env.ADMIN_EMAIL || 'admin@greenpad.com').toLowerCase().trim();
  let passwordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!passwordHash) {
    const plain = process.env.ADMIN_PASSWORD || 'admin123';
    passwordHash = bcrypt.hashSync(plain, 10);
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[seed] Created bootstrap super_admin with ADMIN_PASSWORD — set ADMIN_PASSWORD_HASH and change password via Admin team'
      );
    }
  }

  await AdminAccount.create({
    email,
    passwordHash,
    name: 'Super Admin',
    adminRole: 'super_admin',
    isActive: true,
  });

  console.log(`[seed] AdminAccount bootstrap: super_admin ${email}`);
}

module.exports = seedAdminAccounts;
