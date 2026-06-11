const router = require('express').Router();
const {
  createProject,
  getMyProject,
  customerUploadStageDocument,
  getCustomerDocumentAccess,
} = require('../controllers/projectController');
const { protect } = require('../middleware/auth');
const { adminUploadJson } = require('../controllers/adminUploadController');
const { uploadLimiter } = require('../middleware/userRateLimit');

router.use(protect);

router.post('/create', createProject);
router.get('/my-project', getMyProject);
router.post('/upload', uploadLimiter, adminUploadJson);
router.post('/:id/stage/:stageId/document', customerUploadStageDocument);
router.get('/:id/stage/:stageId/document/:docId/access', getCustomerDocumentAccess);

module.exports = router;
