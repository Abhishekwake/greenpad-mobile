/** Upload mode for a work item — single source of truth for workflow + projects. */
const UPLOAD_MODES = [
  'off',
  'customer_optional',
  'customer_required',
  'team_optional',
  'team_required',
];

function taskUploadMode(task = {}) {
  const customer = task.customerUploadPolicy;
  const team = task.teamUploadPolicy;
  if (customer === 'required') return 'customer_required';
  if (customer === 'optional') return 'customer_optional';
  if (team === 'required') return 'team_required';
  if (team === 'optional') return 'team_optional';
  return 'off';
}

function applyUploadMode(task, mode) {
  const base = {
    ...task,
    docRequired: false,
    mediaUploadPolicy: 'none',
  };
  switch (mode) {
    case 'customer_optional':
      return { ...base, customerUploadPolicy: 'optional', teamUploadPolicy: 'none' };
    case 'customer_required':
      return {
        ...base,
        customerUploadPolicy: 'required',
        teamUploadPolicy: 'none',
        docRequired: true,
      };
    case 'team_optional':
      return { ...base, customerUploadPolicy: 'none', teamUploadPolicy: 'optional' };
    case 'team_required':
      return { ...base, customerUploadPolicy: 'none', teamUploadPolicy: 'required' };
    default:
      return { ...base, customerUploadPolicy: 'none', teamUploadPolicy: 'none' };
  }
}

function normalizeTaskUpload(task) {
  return applyUploadMode(task, taskUploadMode(task));
}

/** Customer app / customer-upload APIs */
function resolveUploadPolicy(task, taskStatus = {}) {
  const policy = taskStatus.customerUploadPolicy ?? task.customerUploadPolicy ?? 'none';
  if (policy === 'required' || policy === 'optional') return policy;
  return 'none';
}

/**
 * Customer-facing upload policy for a workflow task.
 * Supports explicit customerUploadPolicy and legacy templates that only set docRequired.
 */
function effectiveCustomerUploadPolicy(task = {}, { stageVisibleToCustomer = true } = {}) {
  const policy = task.customerUploadPolicy;
  if (policy === 'required' || policy === 'optional') return policy;
  const team = task.teamUploadPolicy || 'none';
  if (stageVisibleToCustomer && task.docRequired && team === 'none') {
    return 'optional';
  }
  return 'none';
}

function stageHasCustomerUploadPolicy(stage) {
  if (!stage) return false;
  const visible = stage.visibleToCustomer !== false;
  const slots = (stage.requiredDocuments || []).some(
    (d) => d.uploadedBy === 'customer' || d.uploadedBy === 'both'
  );
  const tasks = (stage.tasks || []).some(
    (t) => effectiveCustomerUploadPolicy(t, { stageVisibleToCustomer: visible }) !== 'none'
  );
  return slots || tasks;
}

/** Admin panel — team attaches files on the project */
function resolveTeamUploadPolicy(task, taskStatus = {}) {
  const policy = taskStatus.teamUploadPolicy ?? task.teamUploadPolicy ?? 'none';
  if (policy === 'required' || policy === 'optional') return policy;
  return 'none';
}

function normalizePhasesUploads(phases) {
  if (!Array.isArray(phases)) return phases;
  return phases.map((phase) => ({
    ...phase,
    stages: (phase.stages || []).map((stage) => ({
      ...stage,
      documentPolicy: stage.documentPolicy || 'none',
      requiredDocuments: stage.requiredDocuments || [],
      tasks: (stage.tasks || []).map((task) => normalizeTaskUpload(task)),
    })),
  }));
}

module.exports = {
  UPLOAD_MODES,
  taskUploadMode,
  applyUploadMode,
  normalizeTaskUpload,
  normalizePhasesUploads,
  resolveUploadPolicy,
  resolveTeamUploadPolicy,
  effectiveCustomerUploadPolicy,
  stageHasCustomerUploadPolicy,
};
