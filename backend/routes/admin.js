const router = require('express').Router();
const {
  getStats,
  getLeads,
  updateLeadStatus,
  getUsers,
  getUserById,
  listRewards,
  createReward,
  updateReward,
  deleteReward,
  getTransactions,
} = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

router.use(protect, requireAdmin);

router.get('/stats', getStats);
router.get('/transactions', getTransactions);
router.get('/rewards', listRewards);
router.get('/users', getUsers);
router.get('/user/:id', getUserById);
router.get('/leads', getLeads);
router.patch('/lead/:id/status', updateLeadStatus);
router.post('/reward', createReward);
router.put('/reward/:id', updateReward);
router.delete('/reward/:id', deleteReward);

module.exports = router;
