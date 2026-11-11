const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);
router.get('/stats', dashboardController.getDashboardStats);

module.exports = router;
