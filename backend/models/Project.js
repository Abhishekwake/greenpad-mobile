const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    workflowTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowTemplate' },
    customerName: String,
    customerPhone: String,
    address: String,
    status: { type: String, enum: ['active', 'completed', 'on_hold', 'voided'], default: 'active' },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: String, default: null },
    voidReason: { type: String, default: null, maxlength: 500 },
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
        approvalStatus: {
          type: String,
          enum: ['none', 'pending', 'approved'],
          default: 'none',
        },
        approvedBy: String,
        approvedAt: Date,
        comments: [{
          text: String,
          createdBy: String,
          createdAt: { type: Date, default: Date.now },
          isInternal: { type: Boolean, default: false },
        }],
        documents: [{
          name: String,
          url: String,
          cloudinaryPublicId: String,
          resourceType: { type: String, enum: ['image', 'raw'], default: 'raw' },
          format: String,
          docId: String,
          taskId: String,
          mimeType: String,
          uploadedBy: String,
          uploadedAt: { type: Date, default: Date.now },
          verificationStatus: {
            type: String,
            enum: ['pending', 'verified', 'rejected'],
            default: 'pending',
          },
          rejectionReason: String,
        }],
        media: [{
          type: { type: String, enum: ['image', 'video'] },
          url: String,
          caption: String,
          uploadedBy: String,
          uploadedAt: { type: Date, default: Date.now },
        }],
        removedTaskIds: [String],
        tasks: [
          {
            taskId: String,
            name: String,
            assignedRole: String,
            docRequired: Boolean,
            customerUploadPolicy: String,
            teamUploadPolicy: String,
            mediaUploadPolicy: String,
            completed: { type: Boolean, default: false },
            completedBy: String,
            completedAt: Date,
            comments: [{ text: String, by: String, at: Date }],
            photos: [{ url: String, caption: String, uploadedAt: Date, uploadedBy: String }],
            documents: [{ url: String, name: String, uploadedAt: Date, uploadedBy: String }],
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
