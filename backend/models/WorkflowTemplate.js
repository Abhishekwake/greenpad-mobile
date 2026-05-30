const mongoose = require('mongoose');

const taskSchema = {
  taskId: String,
  name: String,
  assignedRole: String,
  docRequired: { type: Boolean, default: false },
};

const stageSchema = {
  stageId: String,
  name: String,
  order: Number,
  visibleToCustomer: { type: Boolean, default: true },
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
