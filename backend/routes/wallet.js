const router = require('express').Router();
const { getBalance, getTransactions, redeemCoins } = require('../controllers/walletController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/balance', getBalance);
router.get('/transactions', getTransactions);
router.post('/redeem', redeemCoins);

module.exports = router;
