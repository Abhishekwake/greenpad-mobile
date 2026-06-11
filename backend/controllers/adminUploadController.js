const multer = require('multer');
const { uploadPrivateDocument, isCloudinaryConfigured } = require('../utils/uploadService');

const MAX_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
});

async function handleUpload(req, res, next) {
  try {
    let buffer;
    let mime;

    if (req.file) {
      buffer = req.file.buffer;
      mime = req.file.mimetype;
    } else if (req.body?.file) {
      const raw = String(req.body.file);
      const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
      buffer = Buffer.from(base64, 'base64');
      mime = req.body.mimeType || 'image/jpeg';
    } else {
      return res.status(400).json({ success: false, message: 'file is required (multipart or base64)' });
    }

    if (buffer.length > MAX_BYTES) {
      return res.status(400).json({ success: false, message: 'File too large (max 10MB)' });
    }

    if (process.env.NODE_ENV === 'production' && !isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Secure document storage is not configured. Contact support.',
      });
    }

    const result = await uploadPrivateDocument(buffer, mime);

    res.json({
      success: true,
      publicId: result.publicId,
      public_id: result.publicId,
      resourceType: result.resourceType,
      format: result.format,
      mimeType: result.mimeType,
      bytes: result.bytes,
    });
  } catch (error) {
    if (error.message?.includes('Allowed formats') || error.message?.includes('too large')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
}

const maybeUpload = (req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) {
    return upload.single('file')(req, res, next);
  }
  next();
};

exports.adminUpload = [maybeUpload, handleUpload];
exports.adminUploadJson = handleUpload;

module.exports.uploadMiddleware = upload;
