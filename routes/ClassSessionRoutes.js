const express = require("express");
const {
  createOrGetClassSession,
  getClassSession,
  saveOffer,
  saveAnswer,
  addCandidate,
  endClassSession,
} = require("../controllers/classSessionController");
const { jwtAuthMiddleware } = require("../middleware/jwt");

const router = express.Router();

router.post("/bookings/:bookingId", jwtAuthMiddleware, createOrGetClassSession);
router.get("/:sessionId", jwtAuthMiddleware, getClassSession);
router.put("/:sessionId/offer", jwtAuthMiddleware, saveOffer);
router.put("/:sessionId/answer", jwtAuthMiddleware, saveAnswer);
router.post("/:sessionId/candidates", jwtAuthMiddleware, addCandidate);
router.put("/:sessionId/end", jwtAuthMiddleware, endClassSession);

module.exports = router;
