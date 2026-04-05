const router = require('express').Router();
const {
  getStats,
  getLeads,
  updateLeadStatus,
  getUsers,
  createReward,
  updateReward,
} = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

router.use(protect, requireAdmin);

router.get('/stats', getStats);
router.get('/leads', getLeads);
router.patch('/lead/:id/status', updateLeadStatus);
router.get('/users', getUsers);
router.post('/reward', createReward);
router.put('/reward/:id', updateReward);

module.exports = router;
