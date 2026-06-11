const WorkflowTemplate = require('../models/WorkflowTemplate');
const Role = require('../models/Role');
const { flattenStagesFromTemplate } = require('../utils/workflowHelpers');
const { normalizeTaskUpload, normalizePhasesUploads } = require('../utils/uploadPolicy');

const TENANT_ID = 'greenpad';

function normalizeStage(stage, stageIndex, phaseIndex) {
  return {
    stageId: stage.stageId || `stage_${phaseIndex + 1}_${stageIndex + 1}_${Date.now()}`,
    name: String(stage.name || `Stage ${stageIndex + 1}`).trim(),
    order: stage.order ?? stageIndex + 1,
    visibleToCustomer: stage.visibleToCustomer !== false,
    documentPolicy: stage.documentPolicy || 'none',
    approvalRequired: Boolean(stage.requiresApproval ?? stage.approvalRequired),
    stageColor: stage.color || stage.stageColor || null,
    stageIcon: stage.icon || stage.stageIcon || null,
    allowStageComments: Boolean(stage.allowStageComments),
    color: stage.color || stage.stageColor || '#1D9E75',
    icon: stage.icon || stage.stageIcon || '📋',
    requiresApproval: Boolean(stage.requiresApproval ?? stage.approvalRequired),
    approvalLabel: String(stage.approvalLabel || 'Approval required').trim(),
    estimatedDays: stage.estimatedDays != null && stage.estimatedDays !== ''
      ? Number(stage.estimatedDays)
      : null,
    requiredDocuments: (stage.requiredDocuments || []).map((doc, docIndex) => ({
      docId: doc.docId || `doc_${phaseIndex + 1}_${stageIndex + 1}_${docIndex + 1}_${Date.now()}`,
      label: String(doc.label || '').trim(),
      uploadedBy: ['customer', 'admin', 'both'].includes(doc.uploadedBy) ? doc.uploadedBy : 'admin',
      required: doc.required !== false,
    })),
    tasks: (stage.tasks || []).map((task, taskIndex) => {
      const normalized = normalizeTaskUpload({
        taskId: task.taskId || `task_${phaseIndex + 1}_${stageIndex + 1}_${taskIndex + 1}_${Date.now()}`,
        name: String(task.name || `Task ${taskIndex + 1}`).trim(),
        assignedRole: String(task.assignedRole || '').trim(),
        customerUploadPolicy: task.customerUploadPolicy,
        teamUploadPolicy: task.teamUploadPolicy,
        docRequired: task.docRequired,
        mediaUploadPolicy: task.mediaUploadPolicy,
      });
      return {
        taskId: normalized.taskId,
        name: normalized.name,
        assignedRole: normalized.assignedRole,
        docRequired: normalized.docRequired,
        customerUploadPolicy: normalized.customerUploadPolicy,
        teamUploadPolicy: normalized.teamUploadPolicy,
        mediaUploadPolicy: normalized.mediaUploadPolicy,
      };
    }),
  };
}

function normalizePhases(phases) {
  if (!Array.isArray(phases) || phases.length === 0) return null;

  return phases.map((phase, phaseIndex) => ({
    phaseId: phase.phaseId || `phase_${phaseIndex + 1}_${Date.now()}`,
    name: String(phase.name || `Phase ${phaseIndex + 1}`).trim(),
    order: phase.order ?? phaseIndex + 1,
    stages: (phase.stages || []).map((stage, stageIndex) =>
      normalizeStage(stage, stageIndex, phaseIndex)
    ),
  }));
}

// GET /api/admin/workflow
exports.getWorkflow = async (req, res, next) => {
  try {
    const template = await WorkflowTemplate.findOne({ tenantId: TENANT_ID }).lean();
    if (!template) {
      return res.status(404).json({ success: false, message: 'Workflow template not found' });
    }

    const data = template.phases?.length
      ? { ...template, phases: normalizePhasesUploads(template.phases) }
      : template;
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/workflow
exports.putWorkflow = async (req, res, next) => {
  try {
    const { name, phases, stages } = req.body;

    let normalizedPhases = normalizePhases(phases);

    // Legacy: accept flat stages and wrap in a single phase
    if (!normalizedPhases && Array.isArray(stages) && stages.length > 0) {
      normalizedPhases = [
        {
          phaseId: 'phase_custom',
          name: 'Workflow',
          order: 1,
          stages: stages.map((stage, index) => ({
            stageId: stage.stageId || `stage_${index + 1}`,
            name: stage.name,
            order: stage.order ?? index + 1,
            visibleToCustomer: stage.visibleToCustomer !== false,
            tasks: stage.tasks || [],
          })),
        },
      ];
    }

    if (!normalizedPhases?.length) {
      return res.status(400).json({ success: false, message: 'phases array is required' });
    }

    const flatCount = flattenStagesFromTemplate({ phases: normalizedPhases }).length;
    if (flatCount === 0) {
      return res.status(400).json({ success: false, message: 'At least one stage is required' });
    }

    const template = await WorkflowTemplate.findOneAndUpdate(
      { tenantId: TENANT_ID },
      {
        tenantId: TENANT_ID,
        name: name || 'Default Solar Workflow',
        version: 2,
        phases: normalizedPhases,
        stages: [],
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: 'Workflow updated',
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/roles
exports.listRoles = async (req, res, next) => {
  try {
    const roles = await Role.find({ tenantId: TENANT_ID, isActive: true })
      .sort({ name: 1 })
      .lean();

    res.json({ success: true, data: roles });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/role
exports.createRole = async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Role name is required' });
    }

    const role = await Role.create({
      tenantId: TENANT_ID,
      name: String(name).trim(),
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: 'Role created',
      data: role,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/role/:id
exports.updateRole = async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Role name is required' });
    }

    const role = await Role.findOneAndUpdate(
      { _id: req.params.id, tenantId: TENANT_ID, isActive: true },
      { name: String(name).trim() },
      { new: true }
    );

    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    res.json({
      success: true,
      message: 'Role updated',
      data: role,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/role/:id
exports.deleteRole = async (req, res, next) => {
  try {
    const role = await Role.findOneAndUpdate(
      { _id: req.params.id, tenantId: TENANT_ID, isActive: true },
      { isActive: false },
      { new: true }
    );

    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    res.json({
      success: true,
      message: 'Role deactivated',
      data: role,
    });
  } catch (error) {
    next(error);
  }
};
