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
  updateProjectStage,
  updateProjectTask,
  addProjectTask,
  deleteProjectTask,
} = require('../controllers/projectController');
const {
  getWorkflow,
  putWorkflow,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
} = require('../controllers/workflowController');
const { protect } = require('../middleware/auth');
const { requirePanelAdmin, requireSuperAdmin } = require('../middleware/rbac');

router.use(protect, requirePanelAdmin);

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
router.get('/leads', getLeads);
router.post('/lead', createLeadAdmin);
router.patch('/lead/:id/status', updateLeadStatus);
router.patch('/lead/:id/assign', updateLeadAssign);
router.get('/agents', listAgents);
router.post('/agent', createAgent);
router.put('/agent/:id', updateAgent);

router.get('/projects', getAdminProjects);
router.get('/project/:id', getAdminProjectById);
router.patch('/project/:id/stage', updateProjectStage);
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

// --- super_admin only ---
router.get('/coin-settings', requireSuperAdmin, getCoinSettingsAdmin);
router.put('/coin-settings', requireSuperAdmin, putCoinSettingsAdmin);

router.get('/accounts', requireSuperAdmin, listAdminAccounts);
router.post('/accounts', requireSuperAdmin, createAdminAccount);
router.patch('/accounts/:id', requireSuperAdmin, updateAdminAccount);

router.get('/reconciliation', requireSuperAdmin, getReconciliationRuns);
router.post('/reconciliation/run', requireSuperAdmin, runReconciliationNow);

module.exports = router;
