const router = require('express').Router();
const { getDashboard, getProfile, updateProfile, updatePushToken } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/dashboard', getDashboard);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/push-token', updatePushToken);

module.exports = router;
