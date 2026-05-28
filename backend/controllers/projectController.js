const Lead = require('../models/Lead');
const Project = require('../models/Project');
const WorkflowTemplate = require('../models/WorkflowTemplate');

function mergeStagesWithTemplate(template, stageStatuses) {
  const statusMap = new Map((stageStatuses || []).map((s) => [s.stageId, s]));

  return [...(template?.stages || [])]
    .sort((a, b) => a.order - b.order)
    .map((stage) => {
      const stageStatus = statusMap.get(stage.stageId) || {};
      const taskStatusMap = new Map((stageStatus.tasks || []).map((t) => [t.taskId, t]));

      return {
        stageId: stage.stageId,
        name: stage.name,
        order: stage.order,
        visibleToCustomer: stage.visibleToCustomer,
        status: stageStatus.status || 'pending',
        delayReason: stageStatus.delayReason,
        delayExpectedDate: stageStatus.delayExpectedDate,
        completedAt: stageStatus.completedAt,
        tasks: (stage.tasks || []).map((task) => {
          const taskStatus = taskStatusMap.get(task.taskId) || {};
          return {
            taskId: task.taskId,
            name: task.name,
            assignedRole: task.assignedRole,
            docRequired: task.docRequired,
            completed: taskStatus.completed || false,
            completedBy: taskStatus.completedBy,
            completedAt: taskStatus.completedAt,
          };
        }),
      };
    });
}

function summarizeStageStatuses(stageStatuses) {
  const total = stageStatuses?.length || 0;
  const done = (stageStatuses || []).filter((s) => s.status === 'done').length;
  const delayedStages = (stageStatuses || []).filter((s) => s.status === 'delayed');

  return {
    done,
    total,
    delayedCount: delayedStages.length,
    delays: delayedStages.map((s) => ({
      stageId: s.stageId,
      delayReason: s.delayReason,
      delayExpectedDate: s.delayExpectedDate,
    })),
  };
}

async function loadTemplateForProject(project) {
  if (project.workflowTemplateId) {
    const template = await WorkflowTemplate.findById(project.workflowTemplateId).lean();
    if (template) return template;
  }
  return WorkflowTemplate.findOne({ tenantId: project.tenantId || 'greenpad' }).lean();
}

function advanceCurrentStage(project, template) {
  const orderedStages = [...(template?.stages || [])].sort((a, b) => a.order - b.order);
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

    const template = await WorkflowTemplate.findOne({ tenantId: 'greenpad' });
    if (!template || !template.stages?.length) {
      return res.status(500).json({ success: false, message: 'Workflow template not configured' });
    }

    const orderedStages = [...template.stages].sort((a, b) => a.order - b.order);
    const firstStage = orderedStages[0];

    const stageStatuses = orderedStages.map((s) => ({
      stageId: s.stageId,
      status: s.order === 1 ? 'active' : 'pending',
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
      data: project,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/project/my-project
exports.getMyProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({ customerId: req.user._id }).lean();
    if (!project) {
      return res.status(404).json({ success: false, message: 'No project found' });
    }

    const template = await loadTemplateForProject(project);
    const stages = mergeStagesWithTemplate(template, project.stageStatuses);

    res.json({
      success: true,
      data: {
        ...project,
        stages,
      },
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
    const project = await Project.findById(req.params.id).lean();
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const template = await loadTemplateForProject(project);
    const stages = mergeStagesWithTemplate(template, project.stageStatuses);

    res.json({
      success: true,
      data: {
        ...project,
        stages,
      },
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
    const stages = mergeStagesWithTemplate(template, project.stageStatuses);

    res.json({
      success: true,
      message: 'Stage updated',
      data: {
        ...project.toObject(),
        stages,
      },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/project/:id/task
exports.updateProjectTask = async (req, res, next) => {
  try {
    const { stageId, taskId, completed, completedBy } = req.body;

    if (!stageId || !taskId) {
      return res.status(400).json({ success: false, message: 'stageId and taskId are required' });
    }
    if (completed === undefined) {
      return res.status(400).json({ success: false, message: 'completed is required' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const stageStatus = project.stageStatuses.find((s) => s.stageId === stageId);
    if (!stageStatus) {
      return res.status(404).json({ success: false, message: 'Stage not found on project' });
    }

    const taskStatus = stageStatus.tasks.find((t) => t.taskId === taskId);
    if (!taskStatus) {
      return res.status(404).json({ success: false, message: 'Task not found on project' });
    }

    taskStatus.completed = Boolean(completed);
    if (completedBy !== undefined) taskStatus.completedBy = completedBy;
    taskStatus.completedAt = completed ? new Date() : undefined;

    await project.save();

    const template = await loadTemplateForProject(project.toObject());
    const stages = mergeStagesWithTemplate(template, project.stageStatuses);

    res.json({
      success: true,
      message: 'Task updated',
      data: {
        ...project.toObject(),
        stages,
      },
    });
  } catch (error) {
    next(error);
  }
};
