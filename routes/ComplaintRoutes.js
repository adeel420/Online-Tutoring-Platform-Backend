const express = require("express");
const {
  createComplaint,
  getComplaints,
  updateComplaintAction,
} = require("../controllers/complaintController");
const { jwtAuthMiddleware } = require("../middleware/jwt");

const router = express.Router();

router.post("/", jwtAuthMiddleware, createComplaint);
router.get("/", jwtAuthMiddleware, getComplaints);
router.put("/:complaintId/action", jwtAuthMiddleware, updateComplaintAction);

module.exports = router;
