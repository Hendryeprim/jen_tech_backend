const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', settingsController.getSettings);
// Only admin can update company settings, divisor, and multiplication rate
router.put('/', requireRole('admin'), settingsController.updateSettings);

module.exports = router;
