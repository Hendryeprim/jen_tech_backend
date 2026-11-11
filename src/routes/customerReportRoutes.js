const express = require('express');
const router = express.Router();
const customerReportController = require('../controllers/customerReportController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', customerReportController.getCustomerReports);
router.post('/', customerReportController.createCustomerReport);
router.post('/sync-quotations', customerReportController.syncFromQuotations);
router.get('/:id', customerReportController.getCustomerReportById);
router.put('/:id', customerReportController.updateCustomerReport);
router.delete('/:id', customerReportController.deleteCustomerReport);

module.exports = router;
