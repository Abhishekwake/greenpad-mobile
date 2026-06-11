const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_PDF = ['application/pdf'];
const ALLOWED_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm'];

const DOCUMENT_FOLDER = 'greenpad/documents';

function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

function detectMimeFromBuffer(buffer) {
  if (!buffer?.length) return null;
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf';
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

function validateBuffer(buffer, declaredMime) {
  if (!buffer?.length) {
    throw new Error('No file uploaded');
  }

  const detected = detectMimeFromBuffer(buffer);
  const mime = detected || declaredMime || '';

  if (mime === 'application/pdf' || detected === 'application/pdf') {
    if (buffer.length > MAX_PDF_BYTES) throw new Error('PDF too large (max 10MB)');
    if (detected !== 'application/pdf') throw new Error('File content is not a valid PDF');
    return { mime: 'application/pdf', kind: 'pdf' };
  }

  if (ALLOWED_IMAGE.includes(mime) || (detected && ALLOWED_IMAGE.includes(detected))) {
    const resolved = detected || mime;
    if (!ALLOWED_IMAGE.includes(resolved)) {
      throw new Error('Image must be JPEG, PNG, or WebP');
    }
    if (buffer.length > MAX_IMAGE_BYTES) throw new Error('Image too large (max 10MB)');
    if (detected && declaredMime && !declaredMime.startsWith('image/')) {
      throw new Error('File content does not match declared type');
    }
    return { mime: resolved, kind: 'image' };
  }

  throw new Error('Allowed formats: JPEG, PNG, WebP, PDF');
}

function uploadStream(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      const b64 = buffer.toString('base64');
      const mime = options.resourceType === 'video' ? 'video/mp4' : 'application/pdf';
      return resolve({
        public_id: `local_${Date.now()}`,
        resource_type: options.resourceType || 'raw',
        format: options.format || 'pdf',
        bytes: buffer.length,
        secure_url: `data:${mime};base64,${b64.slice(0, 200)}…`,
      });
    }

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || 'greenpad',
        resource_type: options.resourceType || 'auto',
        type: options.accessType || 'upload',
        ...options.uploadOptions,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    Readable.from(buffer).pipe(stream);
  });
}

function validateFile(file, kind) {
  if (!file?.buffer?.length) {
    throw new Error('No file uploaded');
  }
  const mime = file.mimetype || '';
  if (kind === 'image') {
    if (!ALLOWED_IMAGE.includes(mime)) throw new Error('Image must be JPEG, PNG, or WebP');
    if (file.size > MAX_IMAGE_BYTES) throw new Error('Image too large (max 10MB)');
  } else if (kind === 'pdf') {
    if (!ALLOWED_PDF.includes(mime)) throw new Error('Document must be PDF');
    if (file.size > MAX_PDF_BYTES) throw new Error('PDF too large (max 10MB)');
  } else if (kind === 'video') {
    if (!ALLOWED_VIDEO.includes(mime)) throw new Error('Video must be MP4, MOV, or WebM');
    if (file.size > MAX_VIDEO_BYTES) throw new Error('Video too large (max 100MB)');
  }
}

async function uploadPrivateDocument(buffer, declaredMime) {
  const { mime, kind } = validateBuffer(buffer, declaredMime);
  const resourceType = kind === 'pdf' ? 'raw' : 'image';
  const uploadOptions = kind === 'pdf' ? { format: 'pdf' } : {};

  const result = await uploadStream(buffer, {
    folder: DOCUMENT_FOLDER,
    resourceType,
    accessType: 'authenticated',
    uploadOptions,
  });

  return {
    publicId: result.public_id,
    resourceType,
    format: result.format || (kind === 'pdf' ? 'pdf' : undefined),
    bytes: result.bytes || buffer.length,
    mimeType: mime,
  };
}

async function uploadImage(file) {
  validateFile(file, 'image');
  const result = await uploadStream(file.buffer, { folder: 'greenpad/images', resourceType: 'image' });
  return { url: result.secure_url || result.url, publicId: result.public_id };
}

async function uploadPdf(file) {
  validateFile(file, 'pdf');
  const result = await uploadStream(file.buffer, {
    folder: DOCUMENT_FOLDER,
    resourceType: 'raw',
    accessType: 'authenticated',
    uploadOptions: { format: 'pdf' },
  });
  return { publicId: result.public_id, resourceType: 'raw', format: 'pdf' };
}

async function uploadVideo(file) {
  validateFile(file, 'video');
  const result = await uploadStream(file.buffer, {
    folder: 'greenpad/videos',
    resourceType: 'video',
  });
  return {
    url: result.secure_url || result.url,
    publicId: result.public_id,
    duration: result.duration,
    thumbnailUrl: result.secure_url?.replace('/upload/', '/upload/w_400,h_600,c_fill/'),
  };
}

async function deleteAsset(publicId, resourceType = 'image') {
  if (!isCloudinaryConfigured() || !publicId || publicId.startsWith('local_')) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type: 'authenticated' });
}

module.exports = {
  uploadImage,
  uploadPdf,
  uploadVideo,
  uploadPrivateDocument,
  deleteAsset,
  isCloudinaryConfigured,
  validateBuffer,
  DOCUMENT_FOLDER,
};
