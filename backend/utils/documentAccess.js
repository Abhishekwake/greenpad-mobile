const cloudinary = require('../config/cloudinary');
const { isCloudinaryConfigured } = require('./uploadService');

const DOCUMENT_FOLDER_PREFIX = 'greenpad/documents';

function isValidDocumentPublicId(publicId) {
  if (!publicId || typeof publicId !== 'string') return false;
  if (publicId.startsWith('local_')) return true;
  return publicId.startsWith(DOCUMENT_FOLDER_PREFIX);
}

function extractPublicIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const match = url.match(/\/(?:image|raw|video)\/upload\/(?:v\d+\/)?(?:s--[^/]+--\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
    if (match?.[1]) return decodeURIComponent(match[1]);
  } catch {
    /* ignore */
  }
  return null;
}

function getSignedDocumentUrl(publicId, { resourceType = 'raw', format } = {}) {
  if (!isCloudinaryConfigured() || !publicId || publicId.startsWith('local_')) {
    return null;
  }

  const opts = {
    resource_type: resourceType,
    type: 'authenticated',
    sign_url: true,
    secure: true,
  };
  if (format) opts.format = format;

  return cloudinary.url(publicId, opts);
}

function resolveDocumentAccessUrl(doc) {
  if (!doc) return null;

  if (doc.cloudinaryPublicId) {
    const signed = getSignedDocumentUrl(doc.cloudinaryPublicId, {
      resourceType: doc.resourceType || 'raw',
      format: doc.format || undefined,
    });
    if (signed) return signed;
  }

  if (doc.url) {
    const extracted = extractPublicIdFromUrl(doc.url);
    if (extracted) {
      const signed = getSignedDocumentUrl(extracted, {
        resourceType: doc.resourceType || (doc.url.includes('/raw/') ? 'raw' : 'image'),
        format: doc.format || undefined,
      });
      if (signed) return signed;
    }
    return doc.url;
  }

  return null;
}

module.exports = {
  DOCUMENT_FOLDER_PREFIX,
  isValidDocumentPublicId,
  extractPublicIdFromUrl,
  getSignedDocumentUrl,
  resolveDocumentAccessUrl,
};
