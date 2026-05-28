const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    tenantId: { type: String, default: 'greenpad' },
    name: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

roleSchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.model('Role', roleSchema);
