const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', profileController.getProfiles);
router.post('/reset-standards', requireRole('admin', 'manager'), profileController.resetNotebookStandards);
router.post('/', requireRole('admin', 'manager'), profileController.createProfile);
router.put('/:id', requireRole('admin', 'manager'), profileController.updateProfile);
router.patch('/:id/toggle-active', requireRole('admin', 'manager'), profileController.toggleProfileActive);
router.delete('/:id', requireRole('admin', 'manager'), profileController.deleteProfile);

module.exports = router;
