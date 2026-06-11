const WorkflowTemplate = require('../models/WorkflowTemplate');
const Project = require('../models/Project');
const Lead = require('../models/Lead');
const ActivityLog = require('../models/ActivityLog');

/**
 * @param {{ req?: import('express').Request, actorType?: string, actorId?: string, actorName?: string, action: string, entityType?: string, entityId?: string, meta?: object }} opts
 */
async function logActivity(opts) {
  try {
    const req = opts.req;
    let actorType = opts.actorType || 'system';
    let actorId = opts.actorId;
    let actorName = opts.actorName;

    if (req?.admin) {
      actorType = 'admin';
      actorId = String(req.admin._id);
      actorName = req.admin.name || 'Admin';
    } else if (req?.user) {
      actorType = 'user';
      actorId = String(req.user._id);
      actorName = req.user.name || 'User';
    }

    await ActivityLog.create({
      actorType,
      actorId,
      actorName,
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId ? String(opts.entityId) : undefined,
      meta: opts.meta,
    });
  } catch (err) {
    console.error('[activity] log failed:', err?.message || err);
  }
}

module.exports = { logActivity, ActivityLog, WorkflowTemplate, Project, Lead };
