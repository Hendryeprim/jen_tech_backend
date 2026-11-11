const express = require('express');
const router = express.Router();
const chargeController = require('../controllers/additionalChargeController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', chargeController.getAdditionalCharges);
router.post('/', requireRole('admin', 'manager'), chargeController.createAdditionalCharge);
router.put('/:id', requireRole('admin', 'manager'), chargeController.updateAdditionalCharge);
router.patch('/:id/toggle-active', requireRole('admin', 'manager'), chargeController.toggleAdditionalChargeActive);

module.exports = router;
