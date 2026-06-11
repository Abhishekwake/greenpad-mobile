const mongoose = require('mongoose');

const taskSchema = {
  taskId: String,
  name: String,
  assignedRole: String,
  docRequired: { type: Boolean, default: false },
  customerUploadPolicy: {
    type: String,
    enum: ['none', 'optional', 'required'],
    default: 'none',
  },
  mediaUploadPolicy: {
    type: String,
    enum: ['none', 'optional', 'required'],
    default: 'none',
  },
  teamUploadPolicy: {
    type: String,
    enum: ['none', 'optional', 'required'],
    default: 'none',
  },
};

const requiredDocumentSchema = {
  docId: String,
  label: String,
  uploadedBy: {
    type: String,
    enum: ['customer', 'admin', 'both'],
    default: 'admin',
  },
  required: { type: Boolean, default: true },
};

const stageSchema = {
  stageId: String,
  name: String,
  order: Number,
  visibleToCustomer: { type: Boolean, default: true },
  documentPolicy: {
    type: String,
    enum: ['none', 'optional', 'required'],
    default: 'none',
  },
  /** @deprecated use requiresApproval */
  approvalRequired: { type: Boolean, default: false },
  /** @deprecated use color */
  stageColor: { type: String, default: null },
  /** @deprecated use icon */
  stageIcon: { type: String, default: null },
  allowStageComments: { type: Boolean, default: false },
  color: { type: String, default: '#1D9E75' },
  icon: { type: String, default: '📋' },
  requiresApproval: { type: Boolean, default: false },
  approvalLabel: { type: String, default: 'Approval required' },
  requiredDocuments: [requiredDocumentSchema],
  estimatedDays: { type: Number, default: null },
  tasks: [taskSchema],
};

const phaseSchema = {
  phaseId: String,
  name: String,
  order: Number,
  stages: [stageSchema],
};

const workflowTemplateSchema = new mongoose.Schema(
  {
    tenantId: { type: String, default: 'greenpad' },
    name: { type: String, default: 'Default Solar Workflow' },
    version: { type: Number, default: 2 },
    /** Hierarchical: Phase → Stage → Task */
    phases: [phaseSchema],
    /** @deprecated flat list — kept for legacy templates */
    stages: [stageSchema],
  },
  { timestamps: true }
);

workflowTemplateSchema.index({ tenantId: 1 });

module.exports = mongoose.model('WorkflowTemplate', workflowTemplateSchema);
