const express = require('express');
const { getPublicCoinRules, getPublicContact } = require('../controllers/settingsController');

const router = express.Router();

router.get('/coin-rules', getPublicCoinRules);
router.get('/contact', getPublicContact);

module.exports = router;
