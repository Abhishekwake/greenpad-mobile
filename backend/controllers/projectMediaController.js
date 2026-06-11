const Project = require('../models/Project');
const WorkflowTemplate = require('../models/WorkflowTemplate');
const {
  flattenStagesFromTemplate,
  resolveUploadPolicy,
  resolveMediaPolicy,
} = require('../utils/workflowHelpers');
const { getCoinSettings, pickFeatureSettings } = require('../utils/getCoinSettings');
const { logActivity } = require('../utils/activityLog');

async function loadTemplateForProject(project) {
  if (project.workflowTemplateId) {
    const template = await WorkflowTemplate.findById(project.workflowTemplateId).lean();
    if (template) return template;
  }
  return WorkflowTemplate.findOne({ tenantId: project.tenantId || 'greenpad' }).lean();
}

function findTemplateStage(template, stageId) {
  return flattenStagesFromTemplate(template).find((s) => s.stageId === stageId);
}

function findTemplateTask(template, stageId, taskId) {
  const stage = findTemplateStage(template, stageId);
  return stage?.tasks?.find((t) => t.taskId === taskId);
}

function getProjectHelpers() {
  return require('./projectController');
}

function actorName(req) {
  if (req.admin?.name) return req.admin.name;
  if (req.user?.name) return req.user.name;
  return 'User';
}

exports.approveProjectStage = async (req, res, next) => {
  try {
    const { id, stageId } = req.params;
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const template = await loadTemplateForProject(project);
    const tplStage = findTemplateStage(template, stageId);
    if (!(tplStage?.requiresApproval ?? tplStage?.approvalRequired)) {
      return res.status(400).json({ success: false, message: 'This stage does not require approval' });
    }

    const stageStatus = project.stageStatuses.find((s) => s.stageId === stageId);
    if (!stageStatus) return res.status(404).json({ success: false, message: 'Stage not found' });

    stageStatus.approvalStatus = 'approved';
    stageStatus.approvedBy = req.admin?.name || 'Admin';
    stageStatus.approvedAt = new Date();
    await project.save();

    await logActivity({
      req,
      action: 'stage_approved',
      entityType: 'Project',
      entityId: project._id,
      meta: { stageId },
    });

    const { buildProjectPayload } = getProjectHelpers();
    res.json({ success: true, data: buildProjectPayload(project.toObject(), template) });
  } catch (error) {
    next(error);
  }
};

exports.addStageComment = async (req, res, next) => {
  try {
    const { id, stageId } = req.params;
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, message: 'text is required' });

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const template = await loadTemplateForProject(project);
    const tplStage = findTemplateStage(template, stageId);
    if (!tplStage?.allowStageComments) {
      return res.status(400).json({ success: false, message: 'Stage comments are not enabled' });
    }

    const stageStatus = project.stageStatuses.find((s) => s.stageId === stageId);
    if (!stageStatus) return res.status(404).json({ success: false, message: 'Stage not found' });

    if (!stageStatus.stageComments) stageStatus.stageComments = [];
    stageStatus.stageComments.push({ text: text.trim(), by: actorName(req), at: new Date() });
    await project.save();

    const { buildProjectPayload } = getProjectHelpers();
    res.json({ success: true, data: buildProjectPayload(project.toObject(), template) });
  } catch (error) {
    next(error);
  }
};

exports.addStageDocument = async (req, res, next) => {
  try {
    const { id, stageId } = req.params;
    const { url, name } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'url is required' });

    const settings = pickFeatureSettings(await getCoinSettings());
    if (!settings.internalDocumentsEnabled) {
      return res.status(403).json({ success: false, message: 'Internal documents are disabled' });
    }

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const template = await loadTemplateForProject(project);
    const tplStage = findTemplateStage(template, stageId);
    if (!tplStage || tplStage.documentPolicy === 'none') {
      return res.status(400).json({ success: false, message: 'Stage documents are not enabled' });
    }

    const stageStatus = project.stageStatuses.find((s) => s.stageId === stageId);
    if (!stageStatus) return res.status(404).json({ success: false, message: 'Stage not found' });

    if (!stageStatus.stageDocuments) stageStatus.stageDocuments = [];
    stageStatus.stageDocuments.push({
      url,
      name: name || 'Document',
      uploadedAt: new Date(),
      uploadedBy: actorName(req),
    });
    await project.save();

    const { buildProjectPayload } = getProjectHelpers();
    res.json({ success: true, data: buildProjectPayload(project.toObject(), template) });
  } catch (error) {
    next(error);
  }
};

exports.addTaskComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stageId, taskId, text } = req.body;
    if (!stageId || !taskId || !text?.trim()) {
      return res.status(400).json({ success: false, message: 'stageId, taskId, and text are required' });
    }

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const stageStatus = project.stageStatuses.find((s) => s.stageId === stageId);
    if (!stageStatus) return res.status(404).json({ success: false, message: 'Stage not found' });

    let taskStatus = stageStatus.tasks.find((t) => t.taskId === taskId);
    if (!taskStatus) {
      taskStatus = { taskId, completed: false, comments: [] };
      stageStatus.tasks.push(taskStatus);
    }
    if (!taskStatus.comments) taskStatus.comments = [];
    taskStatus.comments.push({ text: text.trim(), by: actorName(req), at: new Date() });
    await project.save();

    const template = await loadTemplateForProject(project);
    const { buildProjectPayload } = getProjectHelpers();
    res.json({ success: true, data: buildProjectPayload(project.toObject(), template) });
  } catch (error) {
    next(error);
  }
};

async function addTaskFile(req, res, next, field) {
  try {
    const { id } = req.params;
    const { stageId, taskId, url, name, caption } = req.body;
    if (!stageId || !taskId || !url) {
      return res.status(400).json({ success: false, message: 'stageId, taskId, and url are required' });
    }

    const settings = pickFeatureSettings(await getCoinSettings());
    if (!settings.internalDocumentsEnabled) {
      return res.status(403).json({ success: false, message: 'Internal documents are disabled' });
    }

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const template = await loadTemplateForProject(project);
    const tplTask = findTemplateTask(template, stageId, taskId);
    const policy =
      field === 'photos'
        ? resolveMediaPolicy(tplTask || {}, {})
        : resolveUploadPolicy(tplTask || {}, {});

    if (policy === 'none') {
      return res.status(400).json({ success: false, message: 'Uploads not enabled for this task' });
    }

    const stageStatus = project.stageStatuses.find((s) => s.stageId === stageId);
    if (!stageStatus) return res.status(404).json({ success: false, message: 'Stage not found' });

    let taskStatus = stageStatus.tasks.find((t) => t.taskId === taskId);
    if (!taskStatus) {
      taskStatus = { taskId, completed: false };
      stageStatus.tasks.push(taskStatus);
    }

    if (field === 'photos') {
      if (!taskStatus.photos) taskStatus.photos = [];
      taskStatus.photos.push({
        url,
        caption: caption || '',
        uploadedAt: new Date(),
        uploadedBy: actorName(req),
      });
    } else {
      if (!taskStatus.documents) taskStatus.documents = [];
      taskStatus.documents.push({
        url,
        name: name || 'Document',
        uploadedAt: new Date(),
        uploadedBy: actorName(req),
      });
    }

    await project.save();
    const { buildProjectPayload } = getProjectHelpers();
    res.json({ success: true, data: buildProjectPayload(project.toObject(), template) });
  } catch (error) {
    next(error);
  }
}

exports.addTaskDocument = (req, res, next) => addTaskFile(req, res, next, 'documents');
exports.addTaskPhoto = (req, res, next) => addTaskFile(req, res, next, 'photos');

exports.customerUploadTaskDocument = async (req, res, next) => {
  try {
    const { stageId, taskId, url, name } = req.body;
    if (!stageId || !taskId || !url) {
      return res.status(400).json({ success: false, message: 'stageId, taskId, and url are required' });
    }

    const settings = pickFeatureSettings(await getCoinSettings());
    if (!settings.customerDocumentsEnabled) {
      return res.status(403).json({ success: false, message: 'Customer uploads are disabled' });
    }

    const project = await Project.findOne({ customerId: req.user._id });
    if (!project) return res.status(404).json({ success: false, message: 'No project found' });

    const template = await loadTemplateForProject(project);
    const tplTask = findTemplateTask(template, stageId, taskId);
    const policy = resolveUploadPolicy(tplTask || {}, {});
    if (policy === 'none') {
      return res.status(400).json({ success: false, message: 'Upload not enabled for this task' });
    }

    const stageStatus = project.stageStatuses.find((s) => s.stageId === stageId);
    if (!stageStatus) return res.status(404).json({ success: false, message: 'Stage not found' });

    let taskStatus = stageStatus.tasks.find((t) => t.taskId === taskId);
    if (!taskStatus) {
      taskStatus = { taskId, completed: false };
      stageStatus.tasks.push(taskStatus);
    }
    if (!taskStatus.documents) taskStatus.documents = [];
    taskStatus.documents.push({
      url,
      name: name || 'Document',
      uploadedAt: new Date(),
      uploadedBy: req.user.name || 'Customer',
    });
    await project.save();

    const { buildProjectPayload } = getProjectHelpers();
    res.json({ success: true, data: buildProjectPayload(project.toObject(), template) });
  } catch (error) {
    next(error);
  }
};

exports.findTemplateStage = findTemplateStage;
exports.findTemplateTask = findTemplateTask;
exports.loadTemplateForProject = loadTemplateForProject;
