const express = require('express');
const router = express.Router();
const wayBillController = require('../controllers/wayBillController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', wayBillController.getWayBills);
router.post('/', wayBillController.createWayBill);
router.get('/prefill-quote/:id', wayBillController.getPrefillFromQuotation);
router.get('/:id', wayBillController.getWayBillById);
router.put('/:id', wayBillController.updateWayBill);
router.delete('/:id', wayBillController.deleteWayBill);

module.exports = router;
