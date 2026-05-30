/** Flatten phases → stages (legacy flat `stages` supported). */
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

function mergeStageWithStatus(stage, stageStatus = {}) {
  const taskStatusMap = new Map((stageStatus.tasks || []).map((t) => [t.taskId, t]));
  const removedIds = new Set(stageStatus.removedTaskIds || []);
  const templateTaskIds = new Set((stage.tasks || []).map((t) => t.taskId));

  const mergedTemplateTasks = (stage.tasks || [])
    .filter((task) => !removedIds.has(task.taskId))
    .map((task) => {
    const taskStatus = taskStatusMap.get(task.taskId) || {};
    return {
      taskId: task.taskId,
      name: taskStatus.name || task.name,
      assignedRole: taskStatus.assignedRole || task.assignedRole,
      docRequired: taskStatus.docRequired ?? task.docRequired,
      completed: taskStatus.completed || false,
      completedBy: taskStatus.completedBy,
      completedAt: taskStatus.completedAt,
      comments: taskStatus.comments || [],
      photos: taskStatus.photos || [],
      documents: taskStatus.documents || [],
      isCustom: false,
    };
  });

  const customTasks = (stageStatus.tasks || [])
    .filter((t) => t.taskId && !templateTaskIds.has(t.taskId) && t.name)
    .map((t) => ({
      taskId: t.taskId,
      name: t.name,
      assignedRole: t.assignedRole || '',
      docRequired: t.docRequired ?? false,
      completed: t.completed || false,
      completedBy: t.completedBy,
      completedAt: t.completedAt,
      comments: t.comments || [],
      photos: t.photos || [],
      documents: t.documents || [],
      isCustom: true,
    }));

  return {
    stageId: stage.stageId,
    name: stage.name,
    order: stage.order,
    visibleToCustomer: stage.visibleToCustomer,
    status: stageStatus.status || 'pending',
    delayReason: stageStatus.delayReason,
    delayExpectedDate: stageStatus.delayExpectedDate,
    completedAt: stageStatus.completedAt,
    tasks: [...mergedTemplateTasks, ...customTasks],
  };
}

/** Merge template + project status into flat stage list (backward compatible). */
function mergeStagesWithTemplate(template, stageStatuses) {
  const statusMap = new Map((stageStatuses || []).map((s) => [s.stageId, s]));
  return flattenStagesFromTemplate(template).map((stage) =>
    mergeStageWithStatus(stage, statusMap.get(stage.stageId))
  );
}

/** Merge template + project status into phase → stage → task hierarchy. */
function mergePhasesWithTemplate(template, stageStatuses) {
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
          .map((stage) => mergeStageWithStatus(stage, statusMap.get(stage.stageId))),
      }));
  }

  const flatStages = mergeStagesWithTemplate(template, stageStatuses);
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
function buildCustomerView(phases) {
  const allStages = phases.flatMap((p) =>
    p.stages.map((s) => ({ ...s, phaseId: p.phaseId, phaseName: p.name, phaseOrder: p.order }))
  );

  const visible = allStages.filter((s) => s.visibleToCustomer);
  const activeStage =
    visible.find((s) => s.status === 'active') ||
    visible.find((s) => s.status === 'delayed') ||
    visible.find((s) => s.status === 'pending');

  const activePhase = activeStage
    ? phases.find((p) => p.stages.some((s) => s.stageId === activeStage.stageId))
    : null;

  const pendingTask = activeStage?.tasks?.find((t) => !t.completed) || null;

  let statusLabel = 'Waiting';
  if (activeStage?.status === 'done') statusLabel = 'Completed';
  else if (activeStage?.status === 'delayed') statusLabel = 'Delayed';
  else if (activeStage?.status === 'active') statusLabel = 'In Progress';

  return {
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
  mergeStagesWithTemplate,
  mergePhasesWithTemplate,
  buildCustomerView,
  summarizeStageStatuses,
  syncProjectStageStatuses,
  needsStageSync,
};
