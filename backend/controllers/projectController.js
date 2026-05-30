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
} = require('../utils/workflowHelpers');

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
  if (template && needsStageSync(project.stageStatuses, template)) {
    project.stageStatuses = syncProjectStageStatuses(project.stageStatuses, template);
    const flat = flattenStagesFromTemplate(template);
    const active = project.stageStatuses.find((s) => s.status === 'active');
    project.currentStageId = active?.stageId || flat[0]?.stageId || project.currentStageId;
    if (!project.workflowTemplateId && template._id) {
      project.workflowTemplateId = template._id;
    }
    if (persistSync) {
      await project.save();
    }
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

function buildProjectPayload(project, template) {
  const phases = mergePhasesWithTemplate(template, project.stageStatuses);
  const stages = mergeStagesWithTemplate(template, project.stageStatuses);
  const customerView = buildCustomerView(phases);

  return {
    ...project,
    phases,
    stages,
    customerView,
  };
}

// POST /api/project/create
exports.createProject = async (req, res, next) => {
  try {
    const { leadId, customerId } = req.body;

    if (!leadId || !customerId) {
      return res.status(400).json({ success: false, message: 'leadId and customerId are required' });
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    if (lead.status !== 'converted') {
      return res.status(400).json({
        success: false,
        message: 'Project can only be created from a converted lead',
      });
    }

    const existing = await Project.findOne({ leadId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Project already exists for this lead' });
    }

    const template = await WorkflowTemplate.findOne({ tenantId: 'greenpad' }).lean();
    const orderedStages = flattenStagesFromTemplate(template);
    if (!orderedStages.length) {
      return res.status(500).json({ success: false, message: 'Workflow template not configured' });
    }

    const firstStage = orderedStages[0];

    const stageStatuses = orderedStages.map((s, index) => ({
      stageId: s.stageId,
      status: index === 0 ? 'active' : 'pending',
      tasks: (s.tasks || []).map((t) => ({ taskId: t.taskId, completed: false })),
    }));

    const project = await Project.create({
      customerId,
      leadId,
      workflowTemplateId: template._id,
      customerName: lead.name,
      customerPhone: lead.phone,
      address: lead.address,
      currentStageId: firstStage.stageId,
      stageStatuses,
    });

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: buildProjectPayload(project.toObject(), template),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/project/my-project
exports.getMyProject = async (req, res, next) => {
  try {
    let project = await Project.findOne({ customerId: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'No project found' });
    }

    const loaded = await loadProjectWithTemplate(project._id, { persistSync: true });
    if (!loaded) {
      return res.status(404).json({ success: false, message: 'No project found' });
    }

    res.json({
      success: true,
      data: buildProjectPayload(loaded.project.toObject(), loaded.template),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/projects
exports.getAdminProjects = async (req, res, next) => {
  try {
    const { status, leadId } = req.query;
    const filter = {};

    if (status && ['active', 'completed', 'on_hold'].includes(status)) {
      filter.status = status;
    }
    if (leadId) {
      filter.leadId = leadId;
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

    if (status !== undefined) stageStatus.status = status;
    if (delayReason !== undefined) stageStatus.delayReason = delayReason;
    if (delayExpectedDate !== undefined) stageStatus.delayExpectedDate = delayExpectedDate;

    if (status === 'done') {
      stageStatus.completedAt = new Date();
      const template = await loadTemplateForProject(project);
      advanceCurrentStage(project, template);

      const allDone = project.stageStatuses.every((s) => s.status === 'done');
      if (allDone) {
        project.status = 'completed';
      }
    }

    await project.save();

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
