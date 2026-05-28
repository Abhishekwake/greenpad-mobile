const router = require('express').Router();
const {
  getStats,
  getLeads,
  updateLeadStatus,
  updateLeadAssign,
  getUsers,
  getUserById,
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
} = require('../controllers/adminController');
const {
  getAdminProjects,
  getAdminProjectById,
  updateProjectStage,
  updateProjectTask,
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
const { requireAdmin } = require('../middleware/admin');

router.use(protect, requireAdmin);

router.get('/stats', getStats);
router.get('/transactions', getTransactions);
router.get('/redemptions', getRedemptions);
router.patch('/redemption/:id', updateRedemptionStatus);
router.get('/rewards', listRewards);
router.get('/users', getUsers);
router.get('/user/:id', getUserById);
router.get('/leads', getLeads);
router.patch('/lead/:id/status', updateLeadStatus);
router.patch('/lead/:id/assign', updateLeadAssign);
router.get('/coin-settings', getCoinSettingsAdmin);
router.put('/coin-settings', putCoinSettingsAdmin);
router.get('/agents', listAgents);
router.post('/agent', createAgent);
router.put('/agent/:id', updateAgent);
router.post('/reward', createReward);
router.put('/reward/:id', updateReward);
router.delete('/reward/:id', deleteReward);

router.get('/projects', getAdminProjects);
router.get('/project/:id', getAdminProjectById);
router.patch('/project/:id/stage', updateProjectStage);
router.patch('/project/:id/task', updateProjectTask);

router.get('/workflow', getWorkflow);
router.put('/workflow', putWorkflow);
router.get('/roles', listRoles);
router.post('/role', createRole);
router.put('/role/:id', updateRole);
router.delete('/role/:id', deleteRole);

module.exports = router;
