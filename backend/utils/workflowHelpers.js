function flattenStagesFromTemplate(template) {
  if (template?.phases?.length) {
    const result = [];
    let globalOrder = 0;
    for (const phase of [...template.phases].sort((a, b) => a.order - b.order)) {
      for (const stage of [...(phase.stages || [])].sort((a, b) => a.order - b.order)) {
        globalOrder += 1;
        result.push({
          ...stage,
          phaseId: phase.phaseId,
          phaseName: phase.name,
          phaseOrder: phase.order,
          globalOrder,
        });
      }
    }
    return result;
  }

  return [...(template?.stages || [])]
    .sort((a, b) => a.order - b.order)
    .map((stage, index) => ({
      ...stage,
      phaseId: null,
      phaseName: null,
      phaseOrder: 0,
      globalOrder: index + 1,
    }));
}

const {
  normalizeTaskUpload,
  resolveUploadPolicy,
  resolveTeamUploadPolicy,
  effectiveCustomerUploadPolicy,
} = require('./uploadPolicy');

function resolveMediaPolicy(task, taskStatus = {}) {
  if (taskStatus.mediaUploadPolicy) return taskStatus.mediaUploadPolicy;
  return task.mediaUploadPolicy || 'none';
}

function mergeStageWithStatus(stage, stageStatus = {}, options = {}) {
  const { includeDocUrls = false, stripInternalComments = false } = options;
  const taskStatusMap = new Map((stageStatus.tasks || []).map((t) => [t.taskId, t]));
  const removedIds = new Set(stageStatus.removedTaskIds || []);
  const templateTaskIds = new Set((stage.tasks || []).map((t) => t.taskId));

  const mergedTemplateTasks = (stage.tasks || [])
    .filter((task) => !removedIds.has(task.taskId))
    .map((task) => {
    const tpl = normalizeTaskUpload(task);
    const ts = taskStatusMap.get(task.taskId) || {};
    return {
      taskId: task.taskId,
      name: ts.name || tpl.name,
      assignedRole: ts.assignedRole || tpl.assignedRole,
      docRequired: tpl.docRequired,
      customerUploadPolicy: effectiveCustomerUploadPolicy(tpl, {
        stageVisibleToCustomer: stage.visibleToCustomer !== false,
      }),
      teamUploadPolicy: tpl.teamUploadPolicy,
      mediaUploadPolicy: resolveMediaPolicy(tpl, ts),
      completed: ts.completed || false,
      completedBy: ts.completedBy,
      completedAt: ts.completedAt,
      comments: ts.comments || [],
      photos: ts.photos || [],
      documents: ts.documents || [],
      isCustom: false,
    };
  });

  const customTasks = (stageStatus.tasks || [])
    .filter((t) => t.taskId && !templateTaskIds.has(t.taskId) && t.name)
    .map((t) => {
      const normalized = normalizeTaskUpload(t);
      return {
      taskId: t.taskId,
      name: t.name,
      assignedRole: t.assignedRole || '',
      docRequired: normalized.docRequired,
      customerUploadPolicy: effectiveCustomerUploadPolicy(normalized, {
        stageVisibleToCustomer: stage.visibleToCustomer !== false,
      }),
      teamUploadPolicy: normalized.teamUploadPolicy,
      mediaUploadPolicy: normalized.mediaUploadPolicy,
      completed: t.completed || false,
      completedBy: t.completedBy,
      completedAt: t.completedAt,
      comments: t.comments || [],
      photos: t.photos || [],
      documents: t.documents || [],
      isCustom: true,
    };
    });

  return {
    stageId: stage.stageId,
    name: stage.name,
    order: stage.order,
    visibleToCustomer: stage.visibleToCustomer,
    documentPolicy: stage.documentPolicy || 'none',
    approvalRequired: (stage.requiresApproval ?? stage.approvalRequired) || false,
    stageColor: stage.color || stage.stageColor || null,
    stageIcon: stage.icon || stage.stageIcon || null,
    color: stage.color || stage.stageColor || '#1D9E75',
    icon: stage.icon || stage.stageIcon || '📋',
    requiresApproval: (stage.requiresApproval ?? stage.approvalRequired) || false,
    approvalLabel: stage.approvalLabel || 'Approval required',
    requiredDocuments: stage.requiredDocuments || [],
    estimatedDays: stage.estimatedDays ?? null,
    allowStageComments: stage.allowStageComments || false,
    status: stageStatus.status || 'pending',
    delayReason: stageStatus.delayReason,
    delayExpectedDate: stageStatus.delayExpectedDate,
    completedAt: stageStatus.completedAt,
    approvalStatus: stageStatus.approvalStatus || 'none',
    approvedBy: stageStatus.approvedBy,
    approvedAt: stageStatus.approvedAt,
    stageComments: stageStatus.stageComments || [],
    stageDocuments: stageStatus.stageDocuments || [],
    comments: normalizeStageComments(stageStatus).filter(
      (c) => !stripInternalComments || !c.isInternal
    ),
    documents: normalizeStageDocuments(stageStatus, { includeUrls: includeDocUrls }),
    media: (stageStatus.media || []).map((m) => ({
      _id: m._id,
      type: m.type,
      url: m.url,
      caption: m.caption || '',
      uploadedBy: m.uploadedBy || 'Unknown',
      uploadedAt: m.uploadedAt,
    })),
    tasks: [...mergedTemplateTasks, ...customTasks],
  };
}

function normalizeStageComments(stageStatus = {}) {
  if (stageStatus.comments?.length) {
    return stageStatus.comments.map((c) => ({
      _id: c._id,
      text: c.text,
      createdBy: c.createdBy || 'Unknown',
      createdAt: c.createdAt,
      isInternal: Boolean(c.isInternal),
    }));
  }
  return (stageStatus.stageComments || []).map((c) => ({
    text: c.text,
    createdBy: c.by || c.createdBy || 'Unknown',
    createdAt: c.at || c.createdAt,
    isInternal: false,
  }));
}

function findTemplateStage(template, stageId) {
  return flattenStagesFromTemplate(template).find((s) => s.stageId === stageId);
}

function findTemplateTask(template, stageId, taskId) {
  const stage = findTemplateStage(template, stageId);
  return stage?.tasks?.find((t) => t.taskId === taskId);
}

function normalizeStageDocuments(stageStatus = {}, { includeUrls = false } = {}) {
  const mapDoc = (d) => {
    const base = {
      _id: d._id,
      name: d.name || 'Document',
      docId: d.docId || undefined,
      taskId: d.taskId || undefined,
      mimeType: d.mimeType || undefined,
      uploadedBy: d.uploadedBy || 'Unknown',
      uploadedAt: d.uploadedAt,
      verificationStatus: d.verificationStatus || 'pending',
      rejectionReason: d.rejectionReason || '',
      hasFile: Boolean(d.cloudinaryPublicId || d.url),
    };
    if (includeUrls) {
      base.url = d.url;
      base.cloudinaryPublicId = d.cloudinaryPublicId;
    }
    return base;
  };

  if (stageStatus.documents?.length) {
    return stageStatus.documents.map(mapDoc);
  }
  return (stageStatus.stageDocuments || []).map((d) => ({
    name: d.name || 'Document',
    uploadedBy: d.uploadedBy || 'Unknown',
    uploadedAt: d.uploadedAt,
    verificationStatus: 'pending',
    rejectionReason: '',
    hasFile: Boolean(d.url),
    ...(includeUrls ? { url: d.url } : {}),
  }));
}

function mergeStagesWithTemplate(template, stageStatuses, options = {}) {
  const statusMap = new Map((stageStatuses || []).map((s) => [s.stageId, s]));
  return flattenStagesFromTemplate(template).map((stage) =>
    mergeStageWithStatus(stage, statusMap.get(stage.stageId), options)
  );
}

/** Merge template + project status into phase → stage → task hierarchy. */
function mergePhasesWithTemplate(template, stageStatuses, options = {}) {
  const statusMap = new Map((stageStatuses || []).map((s) => [s.stageId, s]));

  if (template?.phases?.length) {
    return [...template.phases]
      .sort((a, b) => a.order - b.order)
      .map((phase) => ({
        phaseId: phase.phaseId,
        name: phase.name,
        order: phase.order,
        stages: [...(phase.stages || [])]
          .sort((a, b) => a.order - b.order)
          .map((stage) => mergeStageWithStatus(stage, statusMap.get(stage.stageId), options)),
      }));
  }

  const flatStages = mergeStagesWithTemplate(template, stageStatuses, options);
  if (flatStages.length === 0) return [];

  return [
    {
      phaseId: 'phase_legacy',
      name: 'Workflow',
      order: 1,
      stages: flatStages,
    },
  ];
}

/** Simple customer-facing snapshot. */
function buildCustomerView(phases, currentStageId) {
  const allStages = phases.flatMap((p) =>
    p.stages.map((s) => ({ ...s, phaseId: p.phaseId, phaseName: p.name, phaseOrder: p.order }))
  );

  const visible = allStages.filter((s) => s.visibleToCustomer);
  let activeStage = null;
  if (currentStageId) {
    activeStage = visible.find((s) => s.stageId === currentStageId) || null;
  }
  if (!activeStage) {
    activeStage =
      visible.find((s) => s.status === 'active') ||
      visible.find((s) => s.status === 'delayed') ||
      visible.find((s) => s.status === 'pending');
  }

  const activePhase = activeStage
    ? phases.find((p) => p.stages.some((s) => s.stageId === activeStage.stageId))
    : null;

  const pendingTask = activeStage?.tasks?.find((t) => !t.completed) || null;

  let statusLabel = 'Waiting';
  if (activeStage?.status === 'done') statusLabel = 'Completed';
  else if (activeStage?.status === 'delayed') statusLabel = 'Delayed';
  else if (activeStage?.status === 'active') statusLabel = 'In Progress';

  return {
    currentStageId: activeStage?.stageId || null,
    currentPhase: activePhase?.name || null,
    currentStage: activeStage?.name || null,
    currentWork: pendingTask?.name || null,
    assignedTeam: pendingTask?.assignedRole || activeStage?.tasks?.[0]?.assignedRole || null,
    status: activeStage?.status || 'pending',
    statusLabel,
    isDelayed: activeStage?.status === 'delayed',
    delayReason: activeStage?.delayReason || null,
    delayExpectedDate: activeStage?.delayExpectedDate || null,
  };
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

/**
 * Re-align project stageStatuses when template changed (e.g. flat → phased workflow).
 * Preserves status by stage index when IDs no longer match.
 */
function syncProjectStageStatuses(projectStageStatuses, template) {
  const templateStages = flattenStagesFromTemplate(template);
  if (!templateStages.length) return projectStageStatuses || [];

  const existing = projectStageStatuses || [];
  const existingMap = new Map(existing.map((s) => [s.stageId, s]));
  const templateIds = new Set(templateStages.map((s) => s.stageId));
  const overlap = existing.filter((s) => templateIds.has(s.stageId)).length;

  if (overlap === templateStages.length && overlap === existing.length) {
    return existing;
  }

  if (overlap > 0) {
    return templateStages.map((ts) => {
      const prev = existingMap.get(ts.stageId);
      if (prev) {
        const taskIds = new Set((ts.tasks || []).map((t) => t.taskId));
        const prevTasks = new Map((prev.tasks || []).map((t) => [t.taskId, t]));
        return {
          ...prev,
          tasks: (ts.tasks || []).map((t) => {
            const pt = prevTasks.get(t.taskId);
            return pt || { taskId: t.taskId, completed: false };
          }).concat((prev.tasks || []).filter((t) => !taskIds.has(t.taskId))),
        };
      }
      return {
        stageId: ts.stageId,
        status: 'pending',
        tasks: (ts.tasks || []).map((t) => ({ taskId: t.taskId, completed: false })),
      };
    });
  }

  // No ID overlap — map old statuses to new stages by order (legacy project migration)
  let activeAssigned = false;
  return templateStages.map((ts, index) => {
    const prev = existing[index];
    let status = prev?.status || 'pending';
    if (status === 'active') activeAssigned = true;
    if (!activeAssigned && index === 0 && !prev) {
      status = 'active';
      activeAssigned = true;
    }
    const prevTasks = new Map((prev?.tasks || []).map((t) => [t.taskId, t]));
    return {
      stageId: ts.stageId,
      status,
      delayReason: prev?.delayReason,
      delayExpectedDate: prev?.delayExpectedDate,
      completedAt: prev?.completedAt,
      tasks: (ts.tasks || []).map((t, ti) => {
        const pt = prevTasks.get(t.taskId) || prev?.tasks?.[ti];
        return {
          taskId: t.taskId,
          completed: pt?.completed || false,
          completedBy: pt?.completedBy,
          completedAt: pt?.completedAt,
        };
      }),
    };
  });
}

function needsStageSync(projectStageStatuses, template) {
  const templateStages = flattenStagesFromTemplate(template);
  if (!templateStages.length) return false;
  const existing = projectStageStatuses || [];
  const templateIds = new Set(templateStages.map((s) => s.stageId));
  const overlap = existing.filter((s) => templateIds.has(s.stageId)).length;
  return overlap !== templateStages.length || existing.length !== templateStages.length;
}

module.exports = {
  flattenStagesFromTemplate,
  findTemplateStage,
  findTemplateTask,
  mergeStagesWithTemplate,
  mergePhasesWithTemplate,
  buildCustomerView,
  summarizeStageStatuses,
  syncProjectStageStatuses,
  needsStageSync,
  resolveUploadPolicy,
  resolveTeamUploadPolicy,
  resolveMediaPolicy,
};
