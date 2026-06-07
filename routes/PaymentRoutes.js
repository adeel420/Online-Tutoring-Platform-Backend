const express = require("express");
const {
  confirmDevPayment,
  handleJazzCashReturn,
  getAdminPayments,
} = require("../controllers/paymentController");
const { jwtAuthMiddleware } = require("../middleware/jwt");

const router = express.Router();

router.post("/:paymentId/dev-confirm", jwtAuthMiddleware, confirmDevPayment);
router.post("/jazzcash/return", handleJazzCashReturn);
router.get("/jazzcash/return", handleJazzCashReturn);
router.get("/admin/payments", jwtAuthMiddleware, getAdminPayments);

module.exports = router;
