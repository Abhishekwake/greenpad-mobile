const Video = require('../models/Video');
const cloudinary = require('../config/cloudinary');
const { uploadMiddleware } = require('../controllers/uploadController');
const { uploadVideo, uploadImage } = require('../utils/uploadService');
const { logActivity } = require('../utils/activityLog');

const LEGACY_VIDEOS = [
  {
    title: 'Complete Installation Guide',
    description: 'Full walkthrough of a 5kW residential installation',
    location: 'Wardha, Maharashtra',
    cloudinaryPublicId: 'CompleteInstallationVideo_nwgnj9',
    orientation: 'horizontal',
    duration: '3:15',
    sortOrder: 0,
  },
  {
    title: 'Residential Solar Setup',
    description: 'Modern home with rooftop solar panels',
    location: 'Wardha, Maharashtra',
    cloudinaryPublicId: 'Residenttial_tfzpo6',
    orientation: 'vertical',
    duration: '2:30',
    sortOrder: 1,
  },
  {
    title: 'Behind The Scenes: Solar Installation',
    description: 'Expert team installing premium solar panels',
    location: 'Wardha, Maharashtra',
    cloudinaryPublicId: 'InstalltationMontage_ezjsui',
    orientation: 'vertical',
    duration: '1:45',
    sortOrder: 2,
  },
  {
    title: 'Commercial Project: Oxygen Park',
    description: 'Large-scale 50kW commercial installation',
    location: 'Wardha, Maharashtra',
    cloudinaryPublicId: 'CommercialOxygenPark_npbjep',
    orientation: 'horizontal',
    duration: '4:00',
    sortOrder: 3,
  },
];

function formatVideoDoc(doc) {
  const publicId = doc.cloudinaryPublicId;
  const cropMode = doc.orientation === 'horizontal' ? 'limit' : 'scale';
  const url =
    doc.cloudinaryUrl ||
    (publicId
      ? cloudinary.url(publicId, {
          resource_type: 'video',
          quality: 'auto',
          fetch_format: 'auto',
          width: 720,
          crop: cropMode,
        })
      : '');

  const thumbnail =
    doc.thumbnailUrl ||
    (publicId
      ? cloudinary.url(publicId, {
          resource_type: 'video',
          format: 'jpg',
          width: 400,
          height: 225,
          crop: 'fill',
          gravity: 'auto',
          start_offset: '2',
        })
      : '');

  return {
    id: String(doc._id),
    title: doc.title,
    duration: doc.duration || '0:00',
    location: doc.location || '',
    type: doc.orientation || 'vertical',
    description: doc.description || '',
    url,
    thumbnail,
  };
}

async function seedLegacyVideosIfEmpty() {
  const count = await Video.countDocuments();
  if (count > 0) return;
  await Video.insertMany(
    LEGACY_VIDEOS.map((v) => ({
      ...v,
      isPublished: true,
      cloudinaryUrl: cloudinary.url(v.cloudinaryPublicId, {
        resource_type: 'video',
        quality: 'auto',
      }),
    }))
  );
}

exports.getVideos = async (req, res, next) => {
  try {
    await seedLegacyVideosIfEmpty();
    const docs = await Video.find({ isPublished: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
    res.json({ success: true, videos: docs.map(formatVideoDoc) });
  } catch (error) {
    next(error);
  }
};

function formatAdminVideoDoc(doc) {
  const formatted = formatVideoDoc(doc);
  return {
    ...doc,
    displayUrl: formatted.url,
    displayThumbnail: formatted.thumbnail,
  };
}

exports.listAdminVideos = async (req, res, next) => {
  try {
    await seedLegacyVideosIfEmpty();
    const docs = await Video.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
    res.json({ success: true, data: docs.map(formatAdminVideoDoc) });
  } catch (error) {
    next(error);
  }
};

exports.createVideo = async (req, res, next) => {
  try {
    const { title, description, location, orientation, duration, sortOrder, isPublished } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }
    const video = await Video.create({
      title: title.trim(),
      description: description || '',
      location: location || 'Wardha, Maharashtra',
      orientation: orientation === 'horizontal' ? 'horizontal' : 'vertical',
      duration: duration || '0:00',
      sortOrder: sortOrder != null ? Number(sortOrder) : 0,
      isPublished: isPublished !== false,
    });
    await logActivity({ req, action: 'video_created', entityType: 'Video', entityId: video._id });
    res.status(201).json({ success: true, data: video });
  } catch (error) {
    next(error);
  }
};

exports.updateVideo = async (req, res, next) => {
  try {
    const allowed = [
      'title',
      'description',
      'location',
      'orientation',
      'duration',
      'sortOrder',
      'isPublished',
      'cloudinaryPublicId',
      'cloudinaryUrl',
      'thumbnailUrl',
    ];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    const video = await Video.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
    res.json({ success: true, data: formatAdminVideoDoc(video.toObject()) });
  } catch (error) {
    next(error);
  }
};

exports.deleteVideo = async (req, res, next) => {
  try {
    const video = await Video.findByIdAndDelete(req.params.id);
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
    res.json({ success: true, message: 'Video deleted' });
  } catch (error) {
    next(error);
  }
};

function formatDurationSeconds(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return undefined;
  const total = Math.max(0, Math.floor(Number(seconds)));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

exports.uploadVideoFile = [
  uploadMiddleware.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'file is required' });
      }
      const result = await uploadVideo(req.file);
      const autoThumb =
        result.publicId && cloudinary.config().cloud_name
          ? cloudinary.url(result.publicId, {
              resource_type: 'video',
              format: 'jpg',
              width: 400,
              height: 600,
              crop: 'fill',
              gravity: 'auto',
              start_offset: '2',
            })
          : result.thumbnailUrl;

      const video = await Video.findByIdAndUpdate(
        req.params.id,
        {
          cloudinaryPublicId: result.publicId,
          cloudinaryUrl: result.url,
          thumbnailUrl: autoThumb || result.thumbnailUrl,
          duration: formatDurationSeconds(result.duration),
        },
        { new: true }
      );
      if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
      res.json({ success: true, data: formatAdminVideoDoc(video.toObject()) });
    } catch (error) {
      next(error);
    }
  },
];

exports.uploadThumbnailFile = [
  uploadMiddleware.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'file is required' });
      }
      const result = await uploadImage(req.file);
      const video = await Video.findByIdAndUpdate(
        req.params.id,
        { thumbnailUrl: result.url },
        { new: true }
      );
      if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
      res.json({ success: true, data: formatAdminVideoDoc(video.toObject()) });
    } catch (error) {
      next(error);
    }
  },
];

exports.reorderVideos = async (req, res, next) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) {
      return res.status(400).json({ success: false, message: 'order array required' });
    }
    await Promise.all(
      order.map((id, index) => Video.findByIdAndUpdate(id, { sortOrder: index }))
    );
    const docs = await Video.find().sort({ sortOrder: 1 }).lean();
    res.json({ success: true, data: docs });
  } catch (error) {
    next(error);
  }
};

exports.seedLegacyVideosIfEmpty = seedLegacyVideosIfEmpty;
exports.formatVideoDoc = formatVideoDoc;
