const router = require('express').Router();
const { createLead, getMyLeads, rescheduleLead, cancelLead } = require('../controllers/leadController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/create', createLead);
router.get('/my-leads', getMyLeads);
router.put('/:id/reschedule', rescheduleLead);
router.put('/:id/cancel', cancelLead);

module.exports = router;
