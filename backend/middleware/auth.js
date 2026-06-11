const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AdminAccount = require('../models/AdminAccount');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.typ === 'admin') {
      const admin = await AdminAccount.findById(decoded.id).select('-passwordHash -__v');
      if (!admin) {
        return res.status(401).json({ success: false, message: 'Admin account not found' });
      }
      if (!admin.isActive) {
        return res.status(403).json({ success: false, message: 'Admin account deactivated' });
      }
      req.admin = admin;
      return next();
    }

    const user = await User.findById(decoded.id).select('-__v');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account deactivated' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

/** Admin panel routes — rejects mobile/user JWTs (typ !== 'admin'). */
const protectAdmin = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.typ !== 'admin') {
      return res.status(401).json({ success: false, message: 'Admin login required' });
    }

    const admin = await AdminAccount.findById(decoded.id).select('-passwordHash -__v');
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Admin account not found' });
    }
    if (!admin.isActive) {
      return res.status(403).json({ success: false, message: 'Admin account deactivated' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

module.exports = { protect, protectAdmin };
