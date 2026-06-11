const express = require('express');
const {
  getPublicCoinRules,
  getPublicContact,
  getPublicBranding,
  getPublicFeatures,
  getPublicCompany,
} = require('../controllers/settingsController');

const router = express.Router();

router.get('/coin-rules', getPublicCoinRules);
router.get('/contact', getPublicContact);
router.get('/branding', getPublicBranding);
router.get('/features', getPublicFeatures);
router.get('/company', getPublicCompany);

module.exports = router;
