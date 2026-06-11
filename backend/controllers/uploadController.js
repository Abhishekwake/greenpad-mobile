const multer = require('multer');
const { uploadImage, uploadPdf, uploadVideo } = require('../utils/uploadService');
const { logActivity } = require('../utils/activityLog');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

// POST /api/upload — multipart field "file", query type=image|pdf|video
exports.uploadFile = [
  upload.single('file'),
  async (req, res, next) => {
    try {
      const type = String(req.query.type || 'image');
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'file is required' });
      }

      let result;
      if (type === 'pdf') result = await uploadPdf(req.file);
      else if (type === 'video') result = await uploadVideo(req.file);
      else result = await uploadImage(req.file);

      await logActivity({
        req,
        action: 'file_uploaded',
        entityType: 'Upload',
        meta: { type, publicId: result.publicId },
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
];

module.exports.uploadMiddleware = upload;
