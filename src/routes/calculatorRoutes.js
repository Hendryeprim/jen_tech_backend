const express = require('express');
const router = express.Router();
const calculatorController = require('../controllers/calculatorController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);
router.post('/window', calculatorController.calculateWindow);
router.post('/preview-quotation', calculatorController.previewQuotation);

module.exports = router;
