const router = require('express').Router();
const { getReferralStats } = require('../controllers/referralController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/stats', getReferralStats);

module.exports = router;
