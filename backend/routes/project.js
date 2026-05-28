const router = require('express').Router();
const { createProject, getMyProject } = require('../controllers/projectController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/create', createProject);
router.get('/my-project', getMyProject);

module.exports = router;
