const User = require("../models/userModel");
const Booking = require("../models/bookingModel");
const Payment = require("../models/paymentModel");
const {
  sendVerificationCode,
  welcomeCode,
  sendTeacherPendingEmail,
  sendAdminTeacherNotification,
  sendTeacherApprovedEmail,
  sendTeacherRejectedEmail,
} = require("../middleware/email");
const { generateToken } = require("../middleware/jwt");
const { createJazzCashPayload } = require("./paymentController");

const parseAmount = (rate = "") => {
  const amount = Number(String(rate).replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

const formatBooking = (booking) => ({
  id: booking._id,
  studentId: booking.student?._id,
  student: booking.student?.name || "Student",
  studentEmail: booking.student?.email,
  tutorId: booking.tutor?._id,
  tutor: booking.tutor?.name || "Tutor",
  tutorEmail: booking.tutor?.email,
  subject: booking.subject,
  date: booking.day,
  day: booking.day,
  time: `${booking.from} - ${booking.to}`,
  from: booking.from,
  to: booking.to,
  duration: "1 session",
  amount: `PKR ${booking.amount || 0}`,
  rawAmount: booking.amount || 0,
  status: booking.status,
  paymentStatus: booking.paymentStatus,
  paymentMethod: booking.paymentMethod,
  paymentReference: booking.paymentReference,
  createdAt: booking.createdAt,
});

exports.register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      role,
      bankName,
      accountTitle,
      accountNumber,
      iban,
    } = req.body;

    if (!name || !email || !password || !phone || !role) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (!["student", "tutor"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Teacher must upload cnic and experience letter
    if (role === "tutor") {
      if (!req.files?.cnic || !req.files?.experienceLetter) {
        return res
          .status(400)
          .json({
            error: "CNIC and experience letter are required for tutors",
          });
      }

      if (
        !bankName?.trim() ||
        !accountTitle?.trim() ||
        !accountNumber?.trim() ||
        !iban?.trim()
      ) {
        return res
          .status(400)
          .json({ error: "Bank details are required for tutors" });
      }
    }

    const existEmail = await User.findOne({ email });
    if (existEmail) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    const userData = {
      name,
      email,
      password,
      phone,
      role,
      verificationCode,
    };

    // Optional profile picture (both roles)
    if (req.files?.profile?.[0]) {
      userData.profile = req.files.profile[0].path;
    }

    // Tutor documents
    if (role === "tutor") {
      userData.cnic = req.files.cnic[0].path;
      userData.experienceLetter = req.files.experienceLetter[0].path;
      userData.bankDetails = {
        bankName: bankName.trim(),
        accountTitle: accountTitle.trim(),
        accountNumber: accountNumber.trim(),
        iban: iban.trim(),
      };
      userData.isApproved = false;
    }

    const user = new User(userData);
    await user.save();

    // Always send OTP to user
    await sendVerificationCode(email, verificationCode);

    // If tutor: send pending email to teacher + notify admin
    if (role === "tutor") {
      await sendTeacherPendingEmail(email, name);
      await sendAdminTeacherNotification({ name, email, phone });
    }

    res.status(200).json({
      message:
        role === "tutor"
          ? "Signup successful. Your account will be activated after admin approval."
          : "Signup successful. Check your email for verification code.",
    });
  } catch (err) {
    console.error("Signup Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res
        .status(400)
        .json({ error: "Email, password, and role are required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    if (!user.isVerified) {
      return res.status(400).json({ error: "Please verify your email first" });
    }

    if (user.role !== role) {
      return res.status(400).json({ error: "Invalid role selected" });
    }

    // Tutor must be approved by admin
    if (role === "tutor" && !user.isApproved) {
      return res
        .status(403)
        .json({ error: "Your account is pending admin approval" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = generateToken({ id: user._id });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profile: user.profile,
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.verify = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code)
      return res.status(400).json({ error: "Verification code is required" });

    const user = await User.findOne({ verificationCode: code.toString() });
    if (!user)
      return res.status(400).json({ error: "Invalid verification code" });

    user.isVerified = true;
    user.verificationCode = undefined;
    await user.save();

    await welcomeCode(user.email, user.name);

    res.status(200).json({ message: "Email verified successfully" });
  } catch (err) {
    console.error("Verification Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.forgot = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOTP = otp;
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    await sendVerificationCode(email, otp);

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.reset = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res
        .status(400)
        .json({ error: "Email, OTP, and new password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    if (!user.resetPasswordOTP || !user.resetPasswordExpires) {
      return res.status(400).json({ error: "OTP was not requested" });
    }
    if (user.resetPasswordOTP !== otp.toString()) {
      return res.status(400).json({ error: "Invalid OTP" });
    }
    if (user.resetPasswordExpires < new Date()) {
      return res.status(400).json({ error: "OTP has expired" });
    }

    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.loginData = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "-password -verificationCode -resetPasswordOTP -resetPasswordExpires",
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.status(200).json(user);
  } catch (err) {
    console.error("Login Data Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const publicTutorSelect =
  "name email phone profile subject experience rate qualification bio location tags available availabilitySlots isApproved isVerified createdAt";

exports.updateTutorProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role !== "tutor") {
      return res.status(403).json({ error: "Only tutors can update tutor profile" });
    }

    const allowedFields = [
      "name",
      "phone",
      "subject",
      "experience",
      "rate",
      "qualification",
      "bio",
      "location",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) user[field] = req.body[field];
    });

    if (req.body.tags !== undefined) {
      user.tags = Array.isArray(req.body.tags)
        ? req.body.tags
        : req.body.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);
    }

    if (req.body.available !== undefined) {
      user.available = req.body.available === "true" || req.body.available === true;
    }

    const bankFields = ["bankName", "accountTitle", "accountNumber", "iban"];
    if (bankFields.some((field) => req.body[field] !== undefined)) {
      user.bankDetails = {
        ...(user.bankDetails?.toObject?.() || user.bankDetails || {}),
        ...bankFields.reduce((details, field) => {
          if (req.body[field] !== undefined) {
            details[field] = String(req.body[field]).trim();
          }
          return details;
        }, {}),
      };
    }

    if (req.file) {
      user.profile = req.file.path;
    }

    await user.save({ validateBeforeSave: false });

    const updatedUser = await User.findById(user._id).select(
      "-password -verificationCode -resetPasswordOTP -resetPasswordExpires",
    );

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Update Tutor Profile Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateAdminProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can update admin profile" });
    }

    ["name", "phone"].forEach((field) => {
      if (req.body[field] !== undefined) user[field] = req.body[field];
    });

    if (req.file) {
      user.profile = req.file.path;
    }

    await user.save({ validateBeforeSave: false });

    const updatedUser = await User.findById(user._id).select(
      "-password -verificationCode -resetPasswordOTP -resetPasswordExpires",
    );

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Update Admin Profile Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getPublicTutors = async (req, res) => {
  try {
    const tutors = await User.find({
      role: "tutor",
      isApproved: true,
      isVerified: true,
    })
      .select(publicTutorSelect)
      .sort({ updatedAt: -1 });

    const publicTutors = tutors.map((tutor) => {
      const tutorObject = tutor.toObject();
      tutorObject.availabilitySlots = (tutorObject.availabilitySlots || []).filter(
        (slot) => !slot.isBooked,
      );
      return tutorObject;
    });

    res.status(200).json(publicTutors);
  } catch (err) {
    console.error("Get Public Tutors Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateTutorAvailability = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role !== "tutor") {
      return res.status(403).json({ error: "Only tutors can update availability" });
    }

    if (!Array.isArray(req.body.slots)) {
      return res.status(400).json({ error: "Slots must be an array" });
    }

    user.availabilitySlots = req.body.slots
      .filter((slot) => slot.day && slot.from && slot.to)
      .map((slot) => ({
        _id: slot._id,
        day: slot.day,
        from: slot.from,
        to: slot.to,
        isBooked: slot.isBooked === true,
      }));

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      message: "Availability updated successfully",
      availabilitySlots: user.availabilitySlots,
    });
  } catch (err) {
    console.error("Update Tutor Availability Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.bookTutorSlot = async (req, res) => {
  try {
    const { tutorId } = req.params;
    const { slotId } = req.body;

    if (!slotId) return res.status(400).json({ error: "Please select a slot" });

    const student = await User.findById(req.user.id);
    if (!student) return res.status(404).json({ error: "Student not found" });
    if (student.role !== "student") {
      return res.status(403).json({ error: "Only students can book tutor slots" });
    }

    const tutor = await User.findById(tutorId);
    if (!tutor || tutor.role !== "tutor" || !tutor.isApproved || !tutor.isVerified) {
      return res.status(404).json({ error: "Tutor not found" });
    }

    const slot = tutor.availabilitySlots.id(slotId);
    if (!slot) return res.status(404).json({ error: "Slot not found" });
    if (slot.isBooked) return res.status(400).json({ error: "This slot is already booked" });

    const amount = parseAmount(tutor.rate);
    if (!amount) {
      return res.status(400).json({ error: "Tutor rate is not valid" });
    }

    const booking = await Booking.create({
      student: student._id,
      tutor: tutor._id,
      slotId: slot._id,
      day: slot.day,
      from: slot.from,
      to: slot.to,
      subject: tutor.subject,
      rate: tutor.rate,
      amount,
      paymentStatus: "pending",
      status: "pending_payment",
    });

    const payment = await Payment.create({
      booking: booking._id,
      student: student._id,
      tutor: tutor._id,
      amount,
      method: "JazzCash",
      status: "pending",
      transactionRef: `T${Date.now()}${String(student._id).slice(-4)}`,
    });

    const jazzCash = {
      actionUrl:
        process.env.JAZZCASH_POST_URL ||
        "https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform",
      payload: createJazzCashPayload({ booking, payment, student }),
      configured: Boolean(
        process.env.JAZZCASH_MERCHANT_ID &&
          process.env.JAZZCASH_PASSWORD &&
          (process.env.JAZZCASH_INTEGERITY_SALT || process.env.JAZZCASH_INTEGRITY_SALT),
      ),
    };

    res.status(201).json({
      message: "Booking created. Please complete payment.",
      booking,
      payment,
      jazzCash,
    });
  } catch (err) {
    console.error("Book Tutor Slot Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getMyBookings = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const query =
      user.role === "student"
        ? { student: user._id }
        : user.role === "tutor"
          ? { tutor: user._id }
          : {};

    const bookings = await Booking.find(query)
      .populate("student", "name email")
      .populate("tutor", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(bookings.map(formatBooking));
  } catch (err) {
    console.error("Get My Bookings Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.approveTeacher = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role !== "tutor")
      return res.status(400).json({ error: "User is not a tutor" });

    user.isApproved = true;
    user.isVerified = true;
    await user.save({ validateBeforeSave: false });

    await sendTeacherApprovedEmail(user.email, user.name);

    res.status(200).json({ message: "Teacher approved successfully" });
  } catch (err) {
    console.error("Approve Teacher Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.rejectTeacher = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role !== "tutor")
      return res.status(400).json({ error: "User is not a tutor" });

    await sendTeacherRejectedEmail(user.email, user.name);
    await User.findByIdAndDelete(userId);

    res
      .status(200)
      .json({ message: "Teacher rejected and notified successfully" });
  } catch (err) {
    console.error("Reject Teacher Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Admin: Get Pending Tutors with documents ───────────────────────────────
exports.getPendingTutors = async (req, res) => {
  try {
    const tutors = await User.find({ role: "tutor" })
      .select(
        "-password -verificationCode -resetPasswordOTP -resetPasswordExpires",
      )
      .sort({ createdAt: -1 });
    res.status(200).json(tutors);
  } catch (err) {
    console.error("Get Pending Tutors Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: "admin" } })
      .select(
        "-password -verificationCode -resetPasswordOTP -resetPasswordExpires -cnic -experienceLetter -bankDetails",
      )
      .sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (err) {
    console.error("Get All Users Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.isVerified = !user.isVerified;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      message: `User ${user.isVerified ? "activated" : "deactivated"} successfully`,
      isVerified: user.isVerified,
    });
  } catch (err) {
    console.error("Toggle Status Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndDelete(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Delete User Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
