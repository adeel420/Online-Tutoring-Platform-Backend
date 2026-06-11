const Booking = require("../models/bookingModel");
const Complaint = require("../models/complaintModel");
const User = require("../models/userModel");
const {
  sendComplaintConfirmationEmail,
  sendAdminComplaintEmail,
  sendComplaintNoticeEmail,
} = require("../middleware/email");
const { createNotification } = require("../utils/notifications");

const formatComplaint = (complaint, viewer = null) => {
  const viewerId = viewer?._id || viewer?.id;
  const isAgainstViewer =
    viewerId && String(complaint.against?._id || complaint.against) === String(viewerId);
  const isAdmin = viewer?.role === "admin";

  return {
    id: complaint._id,
    bookingId: complaint.booking?._id || complaint.booking,
    complainantId: isAgainstViewer && !isAdmin ? undefined : complaint.complainant?._id,
    complainant:
      isAgainstViewer && !isAdmin
        ? "Anonymous"
        : complaint.complainant?.name || "User",
    complainantEmail:
      isAgainstViewer && !isAdmin ? undefined : complaint.complainant?.email,
    complainantRole: complaint.complainantRole,
    againstId: complaint.against?._id,
    against: complaint.against?.name || "User",
    againstEmail: complaint.against?.email,
    againstRole: complaint.againstRole,
    subject: complaint.subject,
    message: complaint.message,
    status: complaint.status,
    adminNote: complaint.adminNote,
    actionTakenAt: complaint.actionTakenAt,
    createdAt: complaint.createdAt,
  };
};

exports.createComplaint = async (req, res) => {
  try {
    const { bookingId, againstId, subject, message } = req.body;
    if (!againstId || !subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: "Subject and complaint details are required." });
    }

    const complainant = await User.findById(req.user.id);
    if (!complainant || !["student", "tutor"].includes(complainant.role)) {
      return res.status(403).json({ error: "Only students and tutors can file complaints." });
    }

    const against = await User.findById(againstId);
    if (!against || !["student", "tutor"].includes(against.role)) {
      return res.status(404).json({ error: "Complaint user not found." });
    }

    if (complainant.role === against.role) {
      return res.status(400).json({ error: "Complaint must be between student and tutor." });
    }

    let booking = null;
    if (bookingId) {
      booking = await Booking.findById(bookingId);
      if (!booking) return res.status(404).json({ error: "Booking not found." });

      const isStudentComplaint =
        complainant.role === "student" &&
        String(booking.student) === String(complainant._id) &&
        String(booking.tutor) === String(against._id);
      const isTutorComplaint =
        complainant.role === "tutor" &&
        String(booking.tutor) === String(complainant._id) &&
        String(booking.student) === String(against._id);

      if (!isStudentComplaint && !isTutorComplaint) {
        return res.status(403).json({ error: "You can only complain about your own session partner." });
      }
    }

    const complaint = await Complaint.create({
      booking: booking?._id,
      complainant: complainant._id,
      against: against._id,
      complainantRole: complainant.role,
      againstRole: against.role,
      subject: subject.trim(),
      message: message.trim(),
    });

    const populated = await Complaint.findById(complaint._id)
      .populate("complainant", "name email role")
      .populate("against", "name email role");

    const emailData = {
      complainantName: complainant.name,
      complainantEmail: complainant.email,
      complainantRole: complainant.role,
      againstName: against.name,
      againstEmail: against.email,
      againstRole: against.role,
      subject: populated.subject,
      message: populated.message,
      date: populated.createdAt,
    };

    await Promise.allSettled([
      sendComplaintConfirmationEmail(complainant.email, emailData),
      sendAdminComplaintEmail(emailData),
      sendComplaintNoticeEmail(against.email, {
        againstName: against.name,
        subject: populated.subject,
      }),
    ]);

    const io = global.io;
    if (io) {
      const admins = await User.find({ role: "admin" }).select("_id");
      await Promise.allSettled(
        admins.map((admin) =>
          createNotification(io, {
            user: admin._id,
            tab: "complaints",
            title: "New complaint filed",
            body: `${complainant.role} filed a complaint against ${against.role}.`,
            refId: complaint._id,
          }),
        ),
      );
    }

    res.status(201).json({
      message: "Complaint submitted successfully.",
      complaint: formatComplaint(populated, complainant),
    });
  } catch (err) {
    console.error("Create Complaint Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getComplaints = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found." });

    const query =
      user.role === "admin"
        ? {}
        : { $or: [{ complainant: user._id }, { against: user._id }] };

    const complaints = await Complaint.find(query)
      .populate("complainant", "name email role")
      .populate("against", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json(complaints.map((complaint) => formatComplaint(complaint, user)));
  } catch (err) {
    console.error("Get Complaints Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateComplaintAction = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ error: "Only admin can take complaint action." });
    }

    const { status, adminNote } = req.body;
    if (!["resolved", "warned", "banned"].includes(status)) {
      return res.status(400).json({ error: "Invalid complaint action." });
    }

    const complaint = await Complaint.findById(req.params.complaintId)
      .populate("complainant", "name email role")
      .populate("against", "name email role");
    if (!complaint) return res.status(404).json({ error: "Complaint not found." });

    complaint.status = status;
    complaint.adminNote = adminNote || "";
    complaint.actionTakenAt = new Date();
    complaint.actionTakenBy = admin._id;
    await complaint.save();

    if (status === "banned") {
      await User.findByIdAndUpdate(complaint.against._id, { isVerified: false });
    }

    res.status(200).json({
      message: `Complaint ${status} successfully.`,
      complaint: formatComplaint(complaint, admin),
    });
  } catch (err) {
    console.error("Update Complaint Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
