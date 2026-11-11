const express = require('express');
const router = express.Router();
const windowTypeController = require('../controllers/windowTypeController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);
router.get('/', windowTypeController.getWindowTypes);
router.post('/', requireRole('admin', 'manager'), windowTypeController.createWindowType);
router.put('/:id', requireRole('admin', 'manager'), windowTypeController.updateWindowType);
router.delete('/:id', requireRole('admin', 'manager'), windowTypeController.deleteWindowType);

module.exports = router;
