const router = require('express').Router();
const { sendOTP, verifyOTP, applyReferral } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/apply-referral', protect, applyReferral);

module.exports = router;
