const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotationController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', quotationController.getQuotations);
router.get('/:id', quotationController.getQuotationById);
router.post('/', quotationController.createQuotation);
router.put('/:id', quotationController.updateQuotation);
router.patch('/:id/status', quotationController.updateQuotationStatus);
router.post('/:id/duplicate', quotationController.duplicateQuotation);
router.delete('/:id', quotationController.deleteQuotation);

module.exports = router;
