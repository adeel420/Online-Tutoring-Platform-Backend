const express = require("express");
const {
  getConversations,
  getMessages,
  getMaterials,
  getNotifications,
  markTabSeen,
  uploadMessageAttachment,
} = require("../controllers/realtimeController");
const { jwtAuthMiddleware } = require("../middleware/jwt");
const { upload } = require("../middleware/cloudinary");

const router = express.Router();

router.get("/conversations", jwtAuthMiddleware, getConversations);
router.get("/materials", jwtAuthMiddleware, getMaterials);
router.get("/messages/:peerId", jwtAuthMiddleware, getMessages);
router.post(
  "/messages/:peerId/attachments",
  jwtAuthMiddleware,
  upload.single("attachment"),
  uploadMessageAttachment,
);
router.get("/notifications", jwtAuthMiddleware, getNotifications);
router.put("/notifications/:tab/seen", jwtAuthMiddleware, markTabSeen);

module.exports = router;
