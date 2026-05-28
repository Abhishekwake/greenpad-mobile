const mongoose = require('mongoose');

const workflowTemplateSchema = new mongoose.Schema(
  {
    tenantId: { type: String, default: 'greenpad' },
    name: { type: String, default: 'Default Solar Workflow' },
    stages: [
      {
        stageId: String,
        name: String,
        order: Number,
        visibleToCustomer: { type: Boolean, default: true },
        tasks: [
          {
            taskId: String,
            name: String,
            assignedRole: String,
            docRequired: { type: Boolean, default: false },
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

workflowTemplateSchema.index({ tenantId: 1 });

module.exports = mongoose.model('WorkflowTemplate', workflowTemplateSchema);
