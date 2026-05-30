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
        removedTaskIds: [String],
        tasks: [
          {
            taskId: String,
            /** Project-level overrides (custom tasks or renamed work items) */
            name: String,
            assignedRole: String,
            docRequired: Boolean,
            completed: { type: Boolean, default: false },
            completedBy: String,
            completedAt: Date,
            comments: [{ text: String, by: String, at: Date }],
            photos: [{ url: String, caption: String, uploadedAt: Date }],
            documents: [{ url: String, name: String, uploadedAt: Date }],
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
