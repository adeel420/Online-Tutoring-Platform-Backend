const express = require("express");
const { createOrUpdateReview, getReviews } = require("../controllers/reviewController");
const { jwtAuthMiddleware } = require("../middleware/jwt");

const router = express.Router();

router.get("/", jwtAuthMiddleware, getReviews);
router.post("/tutors/:tutorId", jwtAuthMiddleware, createOrUpdateReview);

module.exports = router;
