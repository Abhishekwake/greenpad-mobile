const bcrypt = require('bcryptjs');
const AdminAccount = require('../models/AdminAccount');

// GET /api/admin/accounts
exports.listAdminAccounts = async (req, res, next) => {
  try {
    const accounts = await AdminAccount.find()
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: accounts });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/accounts
exports.createAdminAccount = async (req, res, next) => {
  try {
    const { email, password, name, adminRole } = req.body;

    if (!email || !password || !name || !adminRole) {
      return res.status(400).json({
        success: false,
        message: 'email, password, name, and adminRole are required',
      });
    }
    if (!['super_admin', 'ops'].includes(adminRole)) {
      return res.status(400).json({
        success: false,
        message: 'adminRole must be super_admin or ops',
      });
    }
    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const exists = await AdminAccount.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const account = await AdminAccount.create({
      email: normalizedEmail,
      passwordHash,
      name: String(name).trim(),
      adminRole,
      isActive: true,
    });

    const safe = account.toObject();
    delete safe.passwordHash;

    res.status(201).json({ success: true, data: safe });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/accounts/:id
exports.updateAdminAccount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, adminRole, isActive, password } = req.body;

    const account = await AdminAccount.findById(id);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Admin account not found' });
    }

    if (id === String(req.admin._id) && isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account',
      });
    }

    if (name != null) account.name = String(name).trim();
    if (adminRole != null) {
      if (!['super_admin', 'ops'].includes(adminRole)) {
        return res.status(400).json({ success: false, message: 'Invalid adminRole' });
      }
      account.adminRole = adminRole;
    }
    if (typeof isActive === 'boolean') account.isActive = isActive;
    if (password) {
      if (String(password).length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters',
        });
      }
      account.passwordHash = await bcrypt.hash(String(password), 10);
    }

    await account.save();

    const safe = account.toObject();
    delete safe.passwordHash;

    res.json({ success: true, data: safe });
  } catch (error) {
    next(error);
  }
};
