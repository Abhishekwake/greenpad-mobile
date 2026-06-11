const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    location: { type: String, default: 'Wardha, Maharashtra' },
    cloudinaryPublicId: String,
    cloudinaryUrl: String,
    orientation: { type: String, enum: ['vertical', 'horizontal'], default: 'vertical' },
    duration: { type: String, default: '0:00' },
    sortOrder: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
    thumbnailUrl: String,
  },
  { timestamps: true }
);

videoSchema.index({ isPublished: 1, sortOrder: 1 });

module.exports = mongoose.model('Video', videoSchema);
