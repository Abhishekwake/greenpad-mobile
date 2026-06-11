const mongoose = require('mongoose');

const followUpSchema = {
  note: String,
  status: {
    type: String,
    enum: ['called', 'no_answer', 'callback', 'meeting_set'],
    default: 'called',
  },
  nextFollowUpDate: Date,
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
};

const leadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    email: {
      type: String,
      trim: true,
      default: '',
    },
    source: {
      type: String,
      enum: ['mobile', 'manual', 'walk_in', 'referral'],
      default: 'mobile',
    },
    followUps: [followUpSchema],
    nextFollowUpDate: Date,
    lastFollowUpAt: Date,
    createdByAdmin: String,
    leadType: {
      type: String,
      enum: ['self', 'referral'],
      default: 'self',
    },
    relationshipNote: {
      type: String,
      maxlength: [200, 'Relationship note too long'],
      default: '',
    },
    name: {
      type: String,
      required: [true, 'Lead name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      match: [/^\d{10}$/, 'Phone must be exactly 10 digits'],
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      minlength: [10, 'Address must be at least 10 characters'],
    },
    propertyType: {
      type: String,
      enum: ['Residential', 'Commercial', 'Industrial', 'Agricultural'],
      default: 'Residential',
    },
    roofArea: {
      type: Number,
      min: 100,
      max: 50000,
    },
    preferredDate: {
      type: Date,
    },
    timeSlot: {
      type: String,
      enum: ['morning', 'afternoon', 'evening'],
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['pending', 'contacted', 'visited', 'converted', 'lost', 'voided'],
      default: 'pending',
    },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: String, default: null },
    voidReason: { type: String, default: null, maxlength: 500 },
    assignedTo: {
      type: String,
      default: null,
    },
    assignedAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent',
      default: null,
    },
  },
  { timestamps: true }
);

leadSchema.index({ userId: 1, createdAt: -1 });
leadSchema.index({ status: 1 });
leadSchema.index({ source: 1 });
leadSchema.index({ nextFollowUpDate: 1 });

module.exports = mongoose.model('Lead', leadSchema);
