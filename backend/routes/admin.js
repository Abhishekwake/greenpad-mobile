const router = require('express').Router();
const {
  getStats,
  getLeads,
  updateLeadStatus,
  updateLeadAssign,
  getUsers,
  getUserById,
  updateUserActive,
  createLeadAdmin,
  createLeadManual,
  addLeadFollowUp,
  getLeadsSummary,
  voidLead,
  listRewards,
  createReward,
  updateReward,
  deleteReward,
  getTransactions,
  getRedemptions,
  updateRedemptionStatus,
  getCoinSettingsAdmin,
  putCoinSettingsAdmin,
  listAgents,
  createAgent,
  updateAgent,
  getReconciliationRuns,
  runReconciliationNow,
} = require('../controllers/adminController');
const {
  listAdminAccounts,
  createAdminAccount,
  updateAdminAccount,
} = require('../controllers/adminAccountController');
const {
  getAdminProjects,
  getAdminProjectById,
  createProjectAdmin,
  voidProject,
  updateProjectStage,
  updateProjectTask,
  addProjectTask,
  deleteProjectTask,
  addStageComment,
  addStageDocument,
  patchStageDocument,
  addStageMedia,
  getAdminDocumentAccess,
} = require('../controllers/projectController');
const { approveProjectStage } = require('../controllers/projectMediaController');
const { adminUpload } = require('../controllers/adminUploadController');
const {
  listAdminVideos,
  createVideo,
  updateVideo,
  deleteVideo,
  uploadVideoFile,
  uploadThumbnailFile,
  reorderVideos,
} = require('../controllers/videoController');
const { getAdminActivity } = require('../controllers/settingsController');
const {
  getCompanySettings,
  putCompanySettings,
} = require('../controllers/companySettingsController');
const {
  getWorkflow,
  putWorkflow,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
} = require('../controllers/workflowController');
const { protectAdmin } = require('../middleware/auth');
const { requirePanelAdmin, requireSuperAdmin } = require('../middleware/rbac');
const { uploadLimiter } = require('../middleware/userRateLimit');

router.use(protectAdmin, requirePanelAdmin);

// --- ops + super_admin ---
router.get('/stats', getStats);
router.get('/transactions', getTransactions);
router.get('/redemptions', getRedemptions);
router.patch('/redemption/:id', updateRedemptionStatus);
router.get('/rewards', listRewards);
router.post('/reward', createReward);
router.put('/reward/:id', updateReward);
router.delete('/reward/:id', deleteReward);
router.get('/users', getUsers);
router.get('/user/:id', getUserById);
router.patch('/user/:id', updateUserActive);
router.get('/leads/summary', getLeadsSummary);
router.get('/leads', getLeads);
router.post('/lead/create', createLeadManual);
router.post('/lead/:id/followup', addLeadFollowUp);
router.post('/lead', createLeadAdmin);
router.patch('/lead/:id/status', updateLeadStatus);
router.post('/lead/:id/void', voidLead);
router.post('/lead/:id/create-project', createProjectAdmin);
router.patch('/lead/:id/assign', updateLeadAssign);
router.get('/agents', listAgents);
router.post('/agent', createAgent);
router.put('/agent/:id', updateAgent);

router.get('/projects', getAdminProjects);
router.post('/projects/create', createProjectAdmin);
router.post('/project/create', createProjectAdmin);
router.get('/project/:id', getAdminProjectById);
router.post('/project/:id/void', voidProject);
router.patch('/project/:id/stage', updateProjectStage);
router.patch('/project/:id/stage/:stageId/approve', requireSuperAdmin, approveProjectStage);
router.post('/project/:id/stage/:stageId/comment', addStageComment);
router.post('/project/:id/stage/:stageId/document', addStageDocument);
router.get('/project/:id/stage/:stageId/document/:docId/access', getAdminDocumentAccess);
router.patch('/project/:id/stage/:stageId/document/:docId', patchStageDocument);
router.post('/project/:id/stage/:stageId/media', addStageMedia);
router.post('/upload', uploadLimiter, adminUpload);
router.patch('/project/:id/task', updateProjectTask);
router.post('/project/:id/task', addProjectTask);
router.delete('/project/:id/task', deleteProjectTask);

// Workflow + workflow roles — ops and super_admin
router.get('/workflow', getWorkflow);
router.put('/workflow', putWorkflow);
router.get('/roles', listRoles);
router.post('/role', createRole);
router.put('/role/:id', updateRole);
router.delete('/role/:id', deleteRole);

router.get('/videos', listAdminVideos);
router.post('/videos', createVideo);
router.put('/videos/reorder', reorderVideos);
router.put('/videos/:id', updateVideo);
router.post('/videos/:id/upload', uploadVideoFile);
router.post('/videos/:id/thumbnail', uploadThumbnailFile);
router.delete('/videos/:id', deleteVideo);

router.get('/activity', getAdminActivity);
router.get('/company-settings', requireSuperAdmin, getCompanySettings);
router.put('/company-settings', requireSuperAdmin, putCompanySettings);

// --- super_admin only ---
router.get('/coin-settings', requireSuperAdmin, getCoinSettingsAdmin);
router.put('/coin-settings', requireSuperAdmin, putCoinSettingsAdmin);

router.get('/accounts', requireSuperAdmin, listAdminAccounts);
router.post('/accounts', requireSuperAdmin, createAdminAccount);
router.patch('/accounts/:id', requireSuperAdmin, updateAdminAccount);

router.get('/reconciliation', requireSuperAdmin, getReconciliationRuns);
router.post('/reconciliation/run', requireSuperAdmin, runReconciliationNow);

module.exports = router;
