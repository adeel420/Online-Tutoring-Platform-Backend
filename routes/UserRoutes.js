const express = require("express");
const {
  register,
  login,
  verify,
  forgot,
  reset,
  loginData,
  updateAdminProfile,
  updateTutorProfile,
  updateTutorAvailability,
  getPublicTutors,
  bookTutorSlot,
  getMyBookings,
  approveTeacher,
  rejectTeacher,
  getPendingTutors,
  getAllUsers,
  toggleUserStatus,
  deleteUser,
} = require("../controllers/auth");
const { jwtAuthMiddleware } = require("../middleware/jwt");
const { upload } = require("../middleware/cloudinary");
const router = express.Router();

const uploadFields = upload.fields([
  { name: "profile", maxCount: 1 },
  { name: "cnic", maxCount: 1 },
  { name: "experienceLetter", maxCount: 1 },
]);

router.post("/signup", uploadFields, register);
router.post("/login", login);
router.post("/verify-email", verify);
router.post("/forget-password", forgot);
router.put("/reset-password", reset);
router.get("/login-detail", jwtAuthMiddleware, loginData);
router.put("/admin/profile", jwtAuthMiddleware, upload.single("profile"), updateAdminProfile);
router.put("/tutor/profile", jwtAuthMiddleware, upload.single("profile"), updateTutorProfile);
router.put("/tutor/availability", jwtAuthMiddleware, updateTutorAvailability);
router.get("/tutors", getPublicTutors);
router.post("/tutors/:tutorId/bookings", jwtAuthMiddleware, bookTutorSlot);
router.get("/bookings", jwtAuthMiddleware, getMyBookings);
router.get("/admin/bookings", jwtAuthMiddleware, getMyBookings);
router.put("/approve-teacher/:userId", jwtAuthMiddleware, approveTeacher);
router.delete("/reject-teacher/:userId", jwtAuthMiddleware, rejectTeacher);
router.get("/admin/tutors", jwtAuthMiddleware, getPendingTutors);
router.get("/admin/users", jwtAuthMiddleware, getAllUsers);
router.put("/admin/users/:userId/toggle-status", jwtAuthMiddleware, toggleUserStatus);
router.delete("/admin/users/:userId", jwtAuthMiddleware, deleteUser);

module.exports = router;
