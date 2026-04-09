const router = require('express').Router();
const { sendOTP, verifyOTP, applyReferral, adminLogin } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/admin-login', adminLogin);
router.post('/apply-referral', protect, applyReferral);

module.exports = router;
