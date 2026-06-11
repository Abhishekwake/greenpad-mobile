const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    actorType: { type: String, enum: ['admin', 'user', 'system'], default: 'admin' },
    actorId: String,
    actorName: String,
    action: { type: String, required: true },
    entityType: String,
    entityId: String,
    meta: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ entityType: 1, entityId: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
