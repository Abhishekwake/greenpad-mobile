const { pickFeatureSettings, getCoinSettings } = require('./getCoinSettings');
const { effectiveCustomerUploadPolicy, stageHasCustomerUploadPolicy } = require('./uploadPolicy');
const { isValidDocumentPublicId } = require('./documentAccess');
const { findTemplateStage, findTemplateTask } = require('../utils/workflowHelpers');

async function getFeatureSettings() {
  return pickFeatureSettings(await getCoinSettings());
}

function validatePublicId(publicId) {
  if (!publicId || typeof publicId !== 'string') {
    const err = new Error('publicId is required');
    err.statusCode = 400;
    throw err;
  }
  if (!isValidDocumentPublicId(publicId)) {
    const err = new Error('Invalid document reference');
    err.statusCode = 400;
    throw err;
  }
}

function validateRequiredDocSlot(tplStage, docId) {
  if (!docId) return;
  const slot = (tplStage?.requiredDocuments || []).find((d) => d.docId === docId);
  if (!slot) {
    const err = new Error('Unknown document slot');
    err.statusCode = 400;
    throw err;
  }
  if (slot.uploadedBy !== 'customer' && slot.uploadedBy !== 'both') {
    const err = new Error('This document slot is not for customer upload');
    err.statusCode = 400;
    throw err;
  }
}

function validateCustomerUploadPolicy(template, stageId, taskId, stageStatus) {
  if (!taskId) return;

  const tplStage = findTemplateStage(template, stageId);
  const tplTask = findTemplateTask(template, stageId, taskId);
  const policy = effectiveCustomerUploadPolicy(tplTask || {}, {
    stageVisibleToCustomer: tplStage?.visibleToCustomer !== false,
  });
  if (policy === 'none') {
    const err = new Error('Upload not enabled for this work item');
    err.statusCode = 400;
    throw err;
  }
}

function customerUploadsAllowed(settings, template, stageId) {
  if (settings?.customerDocumentsEnabled) return true;
  const tplStage = findTemplateStage(template, stageId);
  return stageHasCustomerUploadPolicy(tplStage);
}

function validateStageAllowsCustomerUpload(template, stageId, stageStatus, { forCustomer = false } = {}) {
  const tplStage = findTemplateStage(template, stageId);
  const status = stageStatus?.status;

  if (forCustomer && tplStage?.visibleToCustomer === false) {
    const err = new Error('Customer cannot upload documents for this stage');
    err.statusCode = 403;
    throw err;
  }

  if (status !== 'active' && status !== 'delayed') {
    const err = new Error('Documents can only be uploaded for active or delayed stages');
    err.statusCode = 400;
    throw err;
  }

  return tplStage;
}

function getMissingRequiredDocuments(tplStage, stageStatus) {
  const required = (tplStage?.requiredDocuments || []).filter((d) => d.required);
  if (!required.length) return [];

  const uploadedDocIds = new Set(
    (stageStatus?.documents || [])
      .filter((d) => d.verificationStatus !== 'rejected')
      .map((d) => d.docId)
      .filter(Boolean)
  );

  return required.filter((d) => !uploadedDocIds.has(d.docId));
}

function buildDocumentRecord({
  publicId,
  resourceType,
  format,
  mimeType,
  name,
  uploadedBy,
  docId,
  taskId,
}) {
  return {
    name: name || 'Document',
    cloudinaryPublicId: publicId,
    resourceType: resourceType || 'raw',
    format: format || undefined,
    mimeType: mimeType || undefined,
    docId: docId || undefined,
    taskId: taskId || undefined,
    uploadedBy,
    uploadedAt: new Date(),
    verificationStatus: 'pending',
  };
}

module.exports = {
  getFeatureSettings,
  validatePublicId,
  validateRequiredDocSlot,
  validateCustomerUploadPolicy,
  validateStageAllowsCustomerUpload,
  getMissingRequiredDocuments,
  buildDocumentRecord,
  customerUploadsAllowed,
  stageHasCustomerUploadPolicy,
};
