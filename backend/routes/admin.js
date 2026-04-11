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

module.exports = router;
