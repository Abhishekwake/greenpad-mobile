const Lead = require('../models/Lead');
const Project = require('../models/Project');
const WorkflowTemplate = require('../models/WorkflowTemplate');
const {
  flattenStagesFromTemplate,
  mergeStagesWithTemplate,
  mergePhasesWithTemplate,
  buildCustomerView,
  summarizeStageStatuses,
  syncProjectStageStatuses,
  needsStageSync,
  resolveUploadPolicy,
  resolveTeamUploadPolicy,
  findTemplateStage,
  findTemplateTask,
} = require('../utils/workflowHelpers');
const { logActivity } = require('../utils/activityLog');
const { resolveCustomerForLead } = require('../utils/resolveCustomerForLead');
const { linkUserToLeadsByPhone } = require('../utils/linkUserToLeadsByPhone');
const { notifyProjectStageChange } = require('../utils/pushNotifications');
const { resolveDocumentAccessUrl } = require('../utils/documentAccess');
const {
  getFeatureSettings,
  validatePublicId,
  validateRequiredDocSlot,
  validateCustomerUploadPolicy,
  validateStageAllowsCustomerUpload,
  getMissingRequiredDocuments,
  buildDocumentRecord,
  customerUploadsAllowed,
  stageHasCustomerUploadPolicy,
} = require('../utils/documentHelpers');

async function loadTemplateForProject(project) {
  if (project.workflowTemplateId) {
    const template = await WorkflowTemplate.findById(project.workflowTemplateId).lean();
    if (template) return template;
  }
  return WorkflowTemplate.findOne({ tenantId: project.tenantId || 'greenpad' }).lean();
}

/** Sync legacy stage IDs to current template; optionally save to DB. */
async function loadProjectWithTemplate(projectId, { persistSync = false } = {}) {
  const project = await Project.findById(projectId);
  if (!project) return null;

  const template = await loadTemplateForProject(project);
  let needsSave = false;

  if (template && needsStageSync(project.stageStatuses, template)) {
    project.stageStatuses = syncProjectStageStatuses(project.stageStatuses, template);
    const flat = flattenStagesFromTemplate(template);
    const active = project.stageStatuses.find((s) => s.status === 'active');
    project.currentStageId = active?.stageId || flat[0]?.stageId || project.currentStageId;
    if (!project.workflowTemplateId && template._id) {
      project.workflowTemplateId = template._id;
    }
    needsSave = true;
  }

  const activeStages = (project.stageStatuses || []).filter((s) => s.status === 'active');
  if (activeStages.length > 1) {
    const keepId =
      project.currentStageId &&
      activeStages.some((s) => s.stageId === project.currentStageId)
        ? project.currentStageId
        : activeStages[0].stageId;
    for (const s of activeStages) {
      if (s.stageId !== keepId) {
        s.status = 'pending';
      }
    }
    project.currentStageId = keepId;
    needsSave = true;
  }

  if (needsSave && persistSync) {
    await project.save();
  }

  return { project, template };
}

function advanceCurrentStage(project, template) {
  const orderedStages = flattenStagesFromTemplate(template);
  const currentIndex = orderedStages.findIndex((s) => s.stageId === project.currentStageId);

  for (let i = currentIndex + 1; i < orderedStages.length; i += 1) {
    const nextStageId = orderedStages[i].stageId;
    const stageStatus = project.stageStatuses.find((s) => s.stageId === nextStageId);
    if (stageStatus && stageStatus.status !== 'done') {
      stageStatus.status = 'active';
      project.currentStageId = nextStageId;
      return;
    }
  }

  const allDone = project.stageStatuses.every((s) => s.status === 'done');
  if (allDone) {
    project.status = 'completed';
  }
}

function buildProjectPayload(project, template, options = {}) {
  const { forCustomer = false } = options;
  const mergeOptions = {
    includeDocUrls: false,
    stripInternalComments: forCustomer,
  };
  const phases = mergePhasesWithTemplate(template, project.stageStatuses, mergeOptions);
  const stages = mergeStagesWithTemplate(template, project.stageStatuses, mergeOptions);
  const customerView = buildCustomerView(phases, project.currentStageId);

  return {
    ...project,
    phases,
    stages,
    customerView,
  };
}

exports.buildProjectPayload = buildProjectPayload;
exports.loadProjectWithTemplate = loadProjectWithTemplate;

async function createProjectForLead(lead, customerId, req) {
  if (lead.status === 'voided') {
    const err = new Error('Cannot create a project for a voided site visit');
    err.statusCode = 400;
    throw err;
  }
  if (lead.status !== 'converted') {
    const err = new Error('Project can only be created from a converted lead');
    err.statusCode = 400;
    throw err;
  }

  const existing = await Project.findOne({ leadId: lead._id, status: { $ne: 'voided' } });
  if (existing) {
    const err = new Error('Project already exists for this lead');
    err.statusCode = 400;
    throw err;
  }

  const template = await WorkflowTemplate.findOne({ tenantId: 'greenpad' }).lean();
  const orderedStages = flattenStagesFromTemplate(template);
  if (!orderedStages.length) {
    const err = new Error('Workflow template not configured');
    err.statusCode = 500;
    throw err;
  }

  const firstStage = orderedStages[0];
  const stageStatuses = orderedStages.map((s, index) => ({
    stageId: s.stageId,
    status: index === 0 ? 'active' : 'pending',
    tasks: (s.tasks || []).map((t) => ({ taskId: t.taskId, completed: false })),
  }));

  const project = await Project.create({
    customerId,
    leadId: lead._id,
    workflowTemplateId: template._id,
    customerName: lead.name,
    customerPhone: lead.phone,
    address: lead.address,
    currentStageId: firstStage.stageId,
    stageStatuses,
  });

  await logActivity({
    req,
    action: 'project_created',
    entityType: 'Project',
    entityId: project._id,
    meta: { leadId: lead._id, customerId },
  });

  return { project, template };
}

// POST /api/project/create — user or admin
exports.createProject = async (req, res, next) => {
  try {
    const { leadId, customerId: bodyCustomerId } = req.body || {};

    if (!leadId) {
      return res.status(400).json({ success: false, message: 'leadId is required' });
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    let customerId = bodyCustomerId;
    if (!customerId) {
      if (!req.admin) {
        return res.status(400).json({ success: false, message: 'customerId is required' });
      }
      customerId = await resolveCustomerForLead(lead);
    }

    const { project, template } = await createProjectForLead(lead, customerId, req);

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: buildProjectPayload(project.toObject(), template),
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// POST /api/admin/project/create | POST /api/admin/lead/:id/create-project
exports.createProjectAdmin = async (req, res, next) => {
  try {
    const leadId = req.body?.leadId || req.params.id;
    if (!leadId) {
      return res.status(400).json({ success: false, message: 'leadId is required' });
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const customerId = await resolveCustomerForLead(lead);
    const { project, template } = await createProjectForLead(lead, customerId, req);

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: buildProjectPayload(project.toObject(), template),
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

async function findProjectForCustomerUser(user) {
  await linkUserToLeadsByPhone(user);

  let project = await Project.findOne({
    customerId: user._id,
    status: { $ne: 'voided' },
  });

  if (!project) {
    const phone = String(user.phone || '').trim();
    const leadQuery = /^\d{10}$/.test(phone)
      ? {
          status: { $nin: ['voided', 'lost'] },
          $or: [{ userId: user._id }, { phone }],
        }
      : { userId: user._id, status: { $nin: ['voided', 'lost'] } };

    const lead = await Lead.findOne(leadQuery).sort({ updatedAt: -1 });
    if (lead) {
      project = await Project.findOne({ leadId: lead._id, status: { $ne: 'voided' } });
      if (project && String(project.customerId) !== String(user._id)) {
        project.customerId = user._id;
        if (!project.customerPhone) project.customerPhone = phone;
        if (!project.customerName && lead.name) project.customerName = lead.name;
        await project.save();
      }
    }
  }

  if (!project && /^\d{10}$/.test(String(user.phone || '').trim())) {
    project = await Project.findOne({
      customerPhone: String(user.phone).trim(),
      status: { $ne: 'voided' },
    });
    if (project && String(project.customerId) !== String(user._id)) {
      project.customerId = user._id;
      await project.save();
    }
  }

  return project;
}

// GET /api/project/my-project
exports.getMyProject = async (req, res, next) => {
  try {
    const project = await findProjectForCustomerUser(req.user);
    if (!project) {
      return res.status(404).json({ success: false, message: 'No project found' });
    }

    const loaded = await loadProjectWithTemplate(project._id, { persistSync: true });
    if (!loaded) {
      return res.status(404).json({ success: false, message: 'No project found' });
    }

    const features = await getFeatureSettings();
    res.json({
      success: true,
      data: {
        ...buildProjectPayload(loaded.project.toObject(), loaded.template, { forCustomer: true }),
        features,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/projects?view=active|completed|voided|all&status=&leadId=
exports.getAdminProjects = async (req, res, next) => {
  try {
    const { status, leadId, view } = req.query;
    const filter = {};

    if (leadId) {
      filter.leadId = leadId;
    } else if (status && ['active', 'completed', 'on_hold', 'voided'].includes(String(status))) {
      filter.status = String(status);
    } else if (view === 'completed') {
      filter.status = 'completed';
    } else if (view === 'voided') {
      filter.status = 'voided';
    } else if (view === 'all') {
      // no status filter
    } else {
      filter.status = { $in: ['active', 'on_hold'] };
    }

    const projects = await Project.find(filter).sort({ createdAt: -1 }).lean();

    const data = projects.map((project) => ({
      _id: project._id,
      customerId: project.customerId,
      leadId: project.leadId,
      customerName: project.customerName,
      customerPhone: project.customerPhone,
      address: project.address,
      status: project.status,
      voidedAt: project.voidedAt,
      voidReason: project.voidReason,
      currentStageId: project.currentStageId,
      stageSummary: summarizeStageStatuses(project.stageStatuses),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }));

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/project/:id/void — soft void (requires reason; not a hard delete)
exports.voidProject = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const trimmed = reason != null ? String(reason).trim() : '';

    if (trimmed.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'A void reason is required (at least 5 characters)',
      });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    if (project.status === 'voided') {
      return res.status(400).json({ success: false, message: 'Project is already voided' });
    }

    project.status = 'voided';
    project.voidedAt = new Date();
    project.voidedBy = req.admin?.name || 'Admin';
    project.voidReason = trimmed;
    await project.save();

    await logActivity({
      req,
      action: 'project_voided',
      entityType: 'Project',
      entityId: project._id,
      meta: { reason: trimmed },
    });

    res.json({
      success: true,
      message: 'Project voided. It will no longer appear in the active installations list.',
      data: project,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/project/:id
exports.getAdminProjectById = async (req, res, next) => {
  try {
    const loaded = await loadProjectWithTemplate(req.params.id, { persistSync: true });
    if (!loaded) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.json({
      success: true,
      data: buildProjectPayload(loaded.project.toObject(), loaded.template),
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/project/:id/stage
exports.updateProjectStage = async (req, res, next) => {
  try {
    const { stageId, status, delayReason, delayExpectedDate } = req.body;

    if (!stageId) {
      return res.status(400).json({ success: false, message: 'stageId is required' });
    }
    if (status && !['pending', 'active', 'done', 'delayed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid stage status' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const stageStatus = project.stageStatuses.find((s) => s.stageId === stageId);
    if (!stageStatus) {
      return res.status(404).json({ success: false, message: 'Stage not found on project' });
    }

    if (status === 'active') {
      for (const s of project.stageStatuses) {
        if (s.stageId !== stageId && s.status === 'active') {
          s.status = 'pending';
        }
      }
      stageStatus.status = 'active';
      stageStatus.delayReason = undefined;
      stageStatus.delayExpectedDate = undefined;
      project.currentStageId = stageId;
    } else if (status === 'pending') {
      stageStatus.status = 'pending';
      stageStatus.delayReason = undefined;
      stageStatus.delayExpectedDate = undefined;
      if (project.currentStageId === stageId) {
        const templateForPointer = await loadTemplateForProject(project);
        const ordered = flattenStagesFromTemplate(templateForPointer);
        const otherActive = project.stageStatuses.find(
          (s) => s.stageId !== stageId && s.status === 'active'
        );
        if (otherActive) {
          project.currentStageId = otherActive.stageId;
        } else {
          const next = ordered.find((ts) => {
            const ss = project.stageStatuses.find((s) => s.stageId === ts.stageId);
            return ss && (ss.status === 'active' || ss.status === 'delayed' || ss.status === 'pending');
          });
          project.currentStageId = next?.stageId || stageId;
        }
      }
    } else if (status !== undefined) {
      stageStatus.status = status;
    }

    if (delayReason !== undefined) stageStatus.delayReason = delayReason;
    if (delayExpectedDate !== undefined) stageStatus.delayExpectedDate = delayExpectedDate;

    if (status === 'delayed') {
      project.currentStageId = stageId;
    }

    if (status === 'done') {
      const template = await loadTemplateForProject(project);
      const tplStage = findTemplateStage(template, stageId);
      const stageStatusRef = project.stageStatuses.find((s) => s.stageId === stageId);

      if (tplStage?.requiresApproval ?? tplStage?.approvalRequired) {
        if (stageStatusRef?.approvalStatus !== 'approved') {
          return res.status(400).json({
            success: false,
            message: 'Stage requires approval before completion',
          });
        }
      }

      if (tplStage?.documentPolicy === 'required') {
        const docs = stageStatusRef?.documents || stageStatusRef?.stageDocuments || [];
        if (docs.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Required stage documents must be uploaded first',
          });
        }
      }

      const missingRequired = getMissingRequiredDocuments(tplStage, stageStatusRef);
      if (missingRequired.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required documents: ${missingRequired.map((d) => d.label).join(', ')}`,
        });
      }

      stageStatus.completedAt = new Date();
      advanceCurrentStage(project, template);

      const allDone = project.stageStatuses.every((s) => s.status === 'done');
      if (allDone) {
        project.status = 'completed';
      }

      await project.save();
      await notifyProjectStageChange(project, stageId, 'done', tplStage?.name);
      await logActivity({
        req,
        action: 'project_stage_done',
        entityType: 'Project',
        entityId: project._id,
        meta: { stageId },
      });
    } else {
      await project.save();
      if (status === 'delayed') {
        const template = await loadTemplateForProject(project);
        const tplStage = findTemplateStage(template, stageId);
        await notifyProjectStageChange(project, stageId, 'delayed', tplStage?.name);
      }
    }

    const template = await loadTemplateForProject(project.toObject());

    res.json({
      success: true,
      message: 'Stage updated',
      data: buildProjectPayload(project.toObject(), template),
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/project/:id/task
exports.updateProjectTask = async (req, res, next) => {
  try {
    const { stageId, taskId, completed, completedBy, name, assignedRole, docRequired } = req.body;

    if (!stageId || !taskId) {
      return res.status(400).json({ success: false, message: 'stageId and taskId are required' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const stageStatus = project.stageStatuses.find((s) => s.stageId === stageId);
    if (!stageStatus) {
      return res.status(404).json({ success: false, message: 'Stage not found on project' });
    }

    let taskStatus = stageStatus.tasks.find((t) => t.taskId === taskId);
    if (!taskStatus) {
      taskStatus = { taskId, completed: false };
      stageStatus.tasks.push(taskStatus);
    }

    if (completed !== undefined) {
      if (Boolean(completed)) {
        const template = await loadTemplateForProject(project);
        const tplTask = findTemplateTask(template, stageId, taskId);
        const teamPolicy = resolveTeamUploadPolicy(tplTask || {}, taskStatus);
        if (teamPolicy === 'required') {
          const taskDocs = taskStatus.documents || [];
          const stageDocs = stageStatus.documents || stageStatus.stageDocuments || [];
          if (taskDocs.length === 0 && stageDocs.length === 0) {
            return res.status(400).json({
              success: false,
              message:
                'Team upload is required — add a file under Documents below before completing this work item',
            });
          }
        }
      }
      taskStatus.completed = Boolean(completed);
      taskStatus.completedAt = completed ? new Date() : undefined;
    }
    if (completedBy !== undefined) taskStatus.completedBy = completedBy;
    if (name !== undefined) taskStatus.name = String(name).trim();
    if (assignedRole !== undefined) taskStatus.assignedRole = String(assignedRole).trim();
    if (docRequired !== undefined) taskStatus.docRequired = Boolean(docRequired);

    await project.save();

    const template = await loadTemplateForProject(project.toObject());

    res.json({
      success: true,
      message: 'Task updated',
      data: buildProjectPayload(project.toObject(), template),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/project/:id/task
exports.addProjectTask = async (req, res, next) => {
  try {
    const { stageId, name, assignedRole, docRequired } = req.body;

    if (!stageId || !name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'stageId and name are required' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const stageStatus = project.stageStatuses.find((s) => s.stageId === stageId);
    if (!stageStatus) {
      return res.status(404).json({ success: false, message: 'Stage not found on project' });
    }

    const taskId = `task_custom_${Date.now()}`;
    stageStatus.tasks.push({
      taskId,
      name: String(name).trim(),
      assignedRole: assignedRole ? String(assignedRole).trim() : '',
      docRequired: Boolean(docRequired),
      completed: false,
    });

    await project.save();

    const template = await loadTemplateForProject(project.toObject());

    res.status(201).json({
      success: true,
      message: 'Work item added',
      data: buildProjectPayload(project.toObject(), template),
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/project/:id/task
exports.deleteProjectTask = async (req, res, next) => {
  try {
    const { stageId, taskId } = req.body;

    if (!stageId || !taskId) {
      return res.status(400).json({ success: false, message: 'stageId and taskId are required' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const stageStatus = project.stageStatuses.find((s) => s.stageId === stageId);
    if (!stageStatus) {
      return res.status(404).json({ success: false, message: 'Stage not found on project' });
    }

    const isCustom = String(taskId).startsWith('task_custom_');
    const hadCustom = stageStatus.tasks.some((t) => t.taskId === taskId);

    if (isCustom) {
      if (!hadCustom) {
        return res.status(404).json({ success: false, message: 'Task not found on project' });
      }
      stageStatus.tasks = stageStatus.tasks.filter((t) => t.taskId !== taskId);
    } else {
      if (!stageStatus.removedTaskIds) stageStatus.removedTaskIds = [];
      if (stageStatus.removedTaskIds.includes(taskId)) {
        return res.status(404).json({ success: false, message: 'Task not found on project' });
      }
      stageStatus.removedTaskIds.push(taskId);
      stageStatus.tasks = stageStatus.tasks.filter((t) => t.taskId !== taskId);
    }

    await project.save();

    const template = await loadTemplateForProject(project.toObject());

    res.json({
      success: true,
      message: 'Work item removed',
      data: buildProjectPayload(project.toObject(), template),
    });
  } catch (error) {
    next(error);
  }
};

function actorName(req) {
  if (req.admin?.name) return req.admin.name;
  if (req.user?.name) return req.user.name;
  return 'User';
}

async function saveAndReturnProject(project, res) {
  await project.save();
  const template = await loadTemplateForProject(project.toObject());
  return res.json({
    success: true,
    data: buildProjectPayload(project.toObject(), template),
  });
}

function getStageStatus(project, stageId) {
  const stageStatus = project.stageStatuses.find((s) => s.stageId === stageId);
  if (!stageStatus) return null;
  if (!stageStatus.comments) stageStatus.comments = [];
  if (!stageStatus.documents) stageStatus.documents = [];
  if (!stageStatus.media) stageStatus.media = [];
  return stageStatus;
}

exports.addStageComment = async (req, res, next) => {
  try {
    const { id, stageId } = req.params;
    const { text, createdBy, isInternal } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ success: false, message: 'text is required' });
    }

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const stageStatus = getStageStatus(project, stageId);
    if (!stageStatus) return res.status(404).json({ success: false, message: 'Stage not found' });

    stageStatus.comments.push({
      text: text.trim(),
      createdBy: createdBy || actorName(req),
      createdAt: new Date(),
      isInternal: Boolean(isInternal),
    });

    await saveAndReturnProject(project, res);
  } catch (error) {
    next(error);
  }
};

exports.addStageDocument = async (req, res, next) => {
  try {
    const { id, stageId } = req.params;
    const { name, publicId, uploadedBy, docId, taskId, mimeType, resourceType, format, url } =
      req.body;

    const settings = await getFeatureSettings();
    if (!settings.internalDocumentsEnabled) {
      return res.status(403).json({ success: false, message: 'Internal documents are disabled' });
    }

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const template = await loadTemplateForProject(project);
    const tplStage = findTemplateStage(template, stageId);
    if (!tplStage || tplStage.documentPolicy === 'none') {
      const hasTaskUpload = (tplStage?.tasks || []).some(
        (t) => t.teamUploadPolicy === 'optional' || t.teamUploadPolicy === 'required'
      );
      if (!hasTaskUpload && !docId) {
        return res.status(400).json({ success: false, message: 'Stage documents are not enabled' });
      }
    }

    if (url && !publicId) {
      return res.status(400).json({
        success: false,
        message: 'Direct URLs are not accepted. Upload via /admin/upload and pass publicId.',
      });
    }

    validatePublicId(publicId);

    const stageStatus = getStageStatus(project, stageId);
    if (!stageStatus) return res.status(404).json({ success: false, message: 'Stage not found' });

    stageStatus.documents.push(
      buildDocumentRecord({
        publicId,
        resourceType,
        format,
        mimeType,
        name,
        uploadedBy: uploadedBy || actorName(req),
        docId,
        taskId,
      })
    );

    await saveAndReturnProject(project, res);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

exports.patchStageDocument = async (req, res, next) => {
  try {
    const { id, stageId, docId } = req.params;
    const { verificationStatus, rejectionReason } = req.body;

    if (!verificationStatus || !['pending', 'verified', 'rejected'].includes(verificationStatus)) {
      return res.status(400).json({
        success: false,
        message: 'verificationStatus must be pending, verified, or rejected',
      });
    }

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const stageStatus = getStageStatus(project, stageId);
    if (!stageStatus) return res.status(404).json({ success: false, message: 'Stage not found' });

    const doc = stageStatus.documents.id(docId);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    doc.verificationStatus = verificationStatus;
    if (rejectionReason !== undefined) doc.rejectionReason = rejectionReason;

    await saveAndReturnProject(project, res);
  } catch (error) {
    next(error);
  }
};

exports.addStageMedia = async (req, res, next) => {
  try {
    const { id, stageId } = req.params;
    const { type, url, caption, uploadedBy } = req.body;

    if (!url) return res.status(400).json({ success: false, message: 'url is required' });
    if (!type || !['image', 'video'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type must be image or video' });
    }

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const stageStatus = getStageStatus(project, stageId);
    if (!stageStatus) return res.status(404).json({ success: false, message: 'Stage not found' });

    stageStatus.media.push({
      type,
      url,
      caption: caption || '',
      uploadedBy: uploadedBy || actorName(req),
      uploadedAt: new Date(),
    });

    await saveAndReturnProject(project, res);
  } catch (error) {
    next(error);
  }
};

exports.customerUploadStageDocument = async (req, res, next) => {
  try {
    const { id, stageId } = req.params;
    const { name, publicId, docId, taskId, mimeType, resourceType, format, url } = req.body;

    if (url && !publicId) {
      return res.status(400).json({
        success: false,
        message: 'Direct URLs are not accepted. Upload via /project/upload and pass publicId.',
      });
    }

    validatePublicId(publicId);

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    if (String(project.customerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this project' });
    }

    const template = await loadTemplateForProject(project);
    const settings = await getFeatureSettings();
    if (!customerUploadsAllowed(settings, template, stageId)) {
      return res.status(403).json({ success: false, message: 'Customer uploads are disabled' });
    }
    const stageStatus = getStageStatus(project, stageId);
    if (!stageStatus) return res.status(404).json({ success: false, message: 'Stage not found' });

    const tplStage = validateStageAllowsCustomerUpload(template, stageId, stageStatus, {
      forCustomer: true,
    });
    validateRequiredDocSlot(tplStage, docId);
    validateCustomerUploadPolicy(template, stageId, taskId, stageStatus);

    if (!docId && !taskId && !stageHasCustomerUploadPolicy(tplStage)) {
      return res.status(400).json({ success: false, message: 'Upload not enabled for this stage' });
    }

    stageStatus.documents.push(
      buildDocumentRecord({
        publicId,
        resourceType,
        format,
        mimeType,
        name,
        uploadedBy: req.user.name || 'Customer',
        docId,
        taskId,
      })
    );

    await saveAndReturnProject(project, res);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

async function getDocumentAccess(req, res, next, { requireCustomer = false } = {}) {
  try {
    const { id, stageId, docId } = req.params;

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    if (requireCustomer && String(project.customerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this project' });
    }

    const stageStatus = getStageStatus(project, stageId);
    if (!stageStatus) return res.status(404).json({ success: false, message: 'Stage not found' });

    const doc =
      (typeof stageStatus.documents?.id === 'function'
        ? stageStatus.documents.id(docId)
        : null) ||
      (stageStatus.documents || []).find((d) => String(d._id) === String(docId));
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    const accessUrl = resolveDocumentAccessUrl(doc);
    if (!accessUrl) {
      return res.status(404).json({ success: false, message: 'Document file not available' });
    }

    res.json({ success: true, data: { accessUrl } });
  } catch (error) {
    next(error);
  }
}

exports.getCustomerDocumentAccess = (req, res, next) =>
  getDocumentAccess(req, res, next, { requireCustomer: true });

exports.getAdminDocumentAccess = (req, res, next) => getDocumentAccess(req, res, next);
