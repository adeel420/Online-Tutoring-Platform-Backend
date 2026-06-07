const express = require("express");
const {
  getConversations,
  getMessages,
  getNotifications,
  markTabSeen,
} = require("../controllers/realtimeController");
const { jwtAuthMiddleware } = require("../middleware/jwt");

const router = express.Router();

router.get("/conversations", jwtAuthMiddleware, getConversations);
router.get("/messages/:peerId", jwtAuthMiddleware, getMessages);
router.get("/notifications", jwtAuthMiddleware, getNotifications);
router.put("/notifications/:tab/seen", jwtAuthMiddleware, markTabSeen);

module.exports = router;
