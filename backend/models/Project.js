const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    workflowTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowTemplate' },
    customerName: String,
    customerPhone: String,
    address: String,
    status: { type: String, enum: ['active', 'completed', 'on_hold'], default: 'active' },
    currentStageId: String,
    tenantId: { type: String, default: 'greenpad' },
    stageStatuses: [
      {
        stageId: String,
        status: {
          type: String,
          enum: ['pending', 'active', 'done', 'delayed'],
          default: 'pending',
        },
        delayReason: String,
        delayExpectedDate: String,
        completedAt: Date,
        tasks: [
          {
            taskId: String,
            completed: { type: Boolean, default: false },
            completedBy: String,
            completedAt: Date,
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

projectSchema.index({ customerId: 1 });
projectSchema.index({ leadId: 1 });
projectSchema.index({ status: 1 });

module.exports = mongoose.model('Project', projectSchema);
