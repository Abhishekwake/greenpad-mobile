/** Require panel login (super_admin or ops). */
const requirePanelAdmin = (req, res, next) => {
  if (!req.admin) {
    return res.status(403).json({ success: false, message: 'Admin panel access required' });
  }
  if (!req.admin.isActive) {
    return res.status(403).json({ success: false, message: 'Admin account deactivated' });
  }
  next();
};

/** Coin rules + admin team management — super_admin only. */
const requireSuperAdmin = (req, res, next) => {
  if (!req.admin) {
    return res.status(403).json({ success: false, message: 'Admin panel access required' });
  }
  if (req.admin.adminRole !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Super admin access required',
    });
  }
  next();
};

module.exports = { requirePanelAdmin, requireSuperAdmin };
