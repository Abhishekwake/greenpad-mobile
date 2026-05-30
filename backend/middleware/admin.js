/** @deprecated Use requirePanelAdmin from rbac.js */
const { requirePanelAdmin } = require('./rbac');

module.exports = { requireAdmin: requirePanelAdmin };
