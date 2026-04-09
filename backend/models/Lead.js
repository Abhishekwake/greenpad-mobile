const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
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
      enum: ['pending', 'contacted', 'visited', 'converted', 'cancelled', 'not_converted', 'rejected'],
      default: 'pending',
    },
    assignedTo: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

leadSchema.index({ userId: 1, createdAt: -1 });
leadSchema.index({ status: 1 });

module.exports = mongoose.model('Lead', leadSchema);
