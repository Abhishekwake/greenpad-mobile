const router = require('express').Router();
const { uploadFile } = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.post('/', uploadFile);

module.exports = router;
