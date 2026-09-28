const express = require("express");
const {
  confirmDevPayment,
  confirmStripePayment,
  getAdminPayments,
  getTutorPayouts,
  markTutorPaid,
  markAllTutorPaid,
  getTutorEarnings,
} = require("../controllers/paymentController");
const { jwtAuthMiddleware } = require("../middleware/jwt");

const router = express.Router();

router.post("/:paymentId/dev-confirm", jwtAuthMiddleware, confirmDevPayment);
router.post("/:paymentId/stripe-confirm", jwtAuthMiddleware, confirmStripePayment);
router.get("/admin/payments", jwtAuthMiddleware, getAdminPayments);
router.get("/admin/tutor-payouts", jwtAuthMiddleware, getTutorPayouts);
router.put("/:paymentId/mark-tutor-paid", jwtAuthMiddleware, markTutorPaid);
router.put("/admin/mark-all-tutor-paid/:tutorId", jwtAuthMiddleware, markAllTutorPaid);
router.get("/tutor/earnings", jwtAuthMiddleware, getTutorEarnings);

module.exports = router;
