const router = require('express').Router();
const { getVideos } = require('../controllers/videoController');

router.get('/', getVideos);

module.exports = router;
