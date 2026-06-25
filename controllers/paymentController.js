const crypto = require("crypto");
const Booking = require("../models/bookingModel");
const Payment = require("../models/paymentModel");
const User = require("../models/userModel");
const {
  sendStudentPaymentEmail,
  sendTutorPaymentEmail,
  sendAdminPaymentEmail,
} = require("../middleware/email");
const { createNotification } = require("../utils/notifications");

const formatEasyPaisaDate = (date) => {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
};

const createEasyPaisaHash = (payload) => {
  const salt = process.env.EASYPAISA_INTEGRITY_SALT;
  if (!salt) return "";

  const hashString = Object.keys(payload)
    .filter(
      (key) =>
        key !== "pp_SecureHash" &&
        payload[key] !== undefined &&
        payload[key] !== "",
    )
    .sort()
    .map((key) => payload[key])
    .join("&");

  return crypto
    .createHmac("sha256", salt)
    .update(`${salt}&${hashString}`)
    .digest("hex")
    .toUpperCase();
};

const createEasyPaisaPayload = ({ booking, payment, student }) => {
  const now = new Date();
  const expiry = new Date(now.getTime() + 60 * 60 * 1000);
  const payload = {
    pp_Version: "1.1",
    pp_TxnType: "MWALLET",
    pp_Language: "EN",
    pp_MerchantID: process.env.EASYPAISA_MERCHANT_ID || "",
    pp_Password: process.env.EASYPAISA_PASSWORD || "",
    pp_TxnRefNo: payment.transactionRef,
    pp_Amount: String(Math.round(payment.amount * 100)),
    pp_TxnCurrency: "PKR",
    pp_TxnDateTime: formatEasyPaisaDate(now),
    pp_TxnExpiryDateTime: formatEasyPaisaDate(expiry),
    pp_BillReference: String(booking._id),
    pp_Description: `TutorHub session with ${booking.subject || "tutor"}`,
    pp_ReturnURL:
      process.env.EASYPAISA_RETURN_URL ||
      `${process.env.SERVER_URL || "http://localhost:8080"}/payment/easypaisa/return`,
    ppmpf_1: String(booking._id),
    ppmpf_2: String(student._id),
    ppmpf_3: String(booking.tutor),
    ppmpf_4: "",
    ppmpf_5: "",
  };

  payload.pp_SecureHash = createEasyPaisaHash(payload);
  return payload;
};

const sendPaymentEmails = async ({ booking, payment, student, tutor }) => {
  const emailData = {
    studentName: student.name,
    tutorName: tutor.name,
    subject: booking.subject,
    date: booking.date,
    day: booking.day,
    from: booking.from,
    to: booking.to,
    amount: booking.amount,
    paymentReference: payment.transactionRef,
  };

  await Promise.allSettled([
    sendStudentPaymentEmail(student.email, emailData),
    sendTutorPaymentEmail(tutor.email, emailData),
    sendAdminPaymentEmail(emailData),
  ]);
};

const markPaymentPaid = async (payment, gatewayResponse = {}) => {
  if (payment.status === "paid") return payment;

  const booking = await Booking.findById(payment.booking);
  if (!booking) throw new Error("Booking not found");

  const tutor = await User.findById(payment.tutor);
  const student = await User.findById(payment.student);
  if (!tutor || !student) throw new Error("User not found");

  const slot = tutor.availabilitySlots.id(booking.slotId);
  if (!slot) throw new Error("Slot not found");
  if (slot.isBooked) throw new Error("This slot is already booked");

  slot.isBooked = true;
  await tutor.save({ validateBeforeSave: false });

  payment.status = "paid";
  payment.gatewayResponse = gatewayResponse;
  payment.paidAt = new Date();
  await payment.save();

  booking.status = "upcoming";
  booking.paymentStatus = "paid";
  booking.paymentReference = payment.transactionRef;
  booking.paidAt = payment.paidAt;
  await booking.save();

  await sendPaymentEmails({ booking, payment, student, tutor });
  const io = global.io;
  if (io) {
    const admins = await User.find({ role: "admin" }).select("_id");
    await Promise.all([
      createNotification(io, {
        user: student._id,
        tab: "bookings",
        title: "Payment confirmed",
        body: `Your ${booking.subject || "session"} booking is confirmed.`,
        refId: booking._id,
      }),
      createNotification(io, {
        user: tutor._id,
        tab: "bookings",
        title: "New paid session",
        body: `${student.name} paid for ${booking.subject || "your session"}.`,
        refId: booking._id,
      }),
      ...admins.map((admin) =>
        createNotification(io, {
          user: admin._id,
          tab: "payments",
          title: "New payment received",
          body: `${student.name} paid PKR ${payment.amount}.`,
          refId: payment._id,
        }),
      ),
    ]);
  }
  return payment;
};

exports.createEasyPaisaPayload = createEasyPaisaPayload;

exports.getTutorPayouts = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ error: "Only admin can view tutor payouts" });
    }

    const payments = await Payment.find({ status: "paid" })
      .populate("tutor", "name email profile bankDetails")
      .populate("student", "name email")
      .populate("booking", "subject date day from to status")
      .sort({ createdAt: -1 });

    const grouped = {};
    for (const payment of payments) {
      const tutorId = payment.tutor?._id;
      if (!tutorId) continue;
      if (!grouped[tutorId]) {
        grouped[tutorId] = {
          tutorId,
          tutorName: payment.tutor?.name || "Unknown Tutor",
          tutorEmail: payment.tutor?.email,
          tutorProfile: payment.tutor?.profile,
          bankDetails: payment.tutor?.bankDetails || {},
          totalEarnings: 0,
          totalPaid: 0,
          totalUnpaid: 0,
          sessions: [],
        };
      }
      const tutorAmount = payment.amount * 0.9;
      grouped[tutorId].totalEarnings += tutorAmount;
      if (payment.tutorPayoutStatus === "paid") {
        grouped[tutorId].totalPaid += tutorAmount;
      } else {
        grouped[tutorId].totalUnpaid += tutorAmount;
      }
      grouped[tutorId].sessions.push({
        paymentId: payment._id,
        student: payment.student?.name || "Student",
        subject: payment.booking?.subject,
        date: payment.booking?.date,
        day: payment.booking?.day,
        amount: payment.amount,
        tutorAmount,
        tutorPayoutStatus: payment.tutorPayoutStatus,
        tutorPaidAt: payment.tutorPaidAt,
        bookingStatus: payment.booking?.status,
      });
    }

    res.status(200).json(Object.values(grouped));
  } catch (err) {
    console.error("Get Tutor Payouts Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.markTutorPaid = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ error: "Only admin can mark tutor payout" });
    }

    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    if (payment.status !== "paid") {
      return res.status(400).json({ error: "Student payment is not confirmed yet" });
    }
    if (payment.tutorPayoutStatus === "paid") {
      return res.status(400).json({ error: "Tutor payout already marked as paid" });
    }

    payment.tutorPayoutStatus = "paid";
    payment.tutorPaidAt = new Date();
    await payment.save();

    const io = global.io;
    if (io) {
      await createNotification(io, {
        user: payment.tutor,
        tab: "earnings",
        title: "Payout received",
        body: `Your payout of PKR ${Math.round(payment.amount * 0.9)} has been released.`,
        refId: payment._id,
      });
    }

    res.status(200).json({ message: "Tutor payout marked as paid" });
  } catch (err) {
    console.error("Mark Tutor Paid Error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
};

exports.markAllTutorPaid = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ error: "Only admin can mark tutor payout" });
    }

    const { tutorId } = req.params;
    const payments = await Payment.find({
      tutor: tutorId,
      status: "paid",
      tutorPayoutStatus: "unpaid",
    });

    if (payments.length === 0) {
      return res.status(400).json({ error: "No unpaid payouts found for this tutor" });
    }

    const now = new Date();
    for (const payment of payments) {
      payment.tutorPayoutStatus = "paid";
      payment.tutorPaidAt = now;
      await payment.save();
    }

    const totalPaid = payments.reduce((sum, p) => sum + p.amount * 0.9, 0);

    const io = global.io;
    if (io) {
      await createNotification(io, {
        user: tutorId,
        tab: "earnings",
        title: "Bulk payout received",
        body: `All your pending payouts (PKR ${Math.round(totalPaid)}) have been released.`,
      });
    }

    res.status(200).json({
      message: `Marked ${payments.length} payments as paid`,
      count: payments.length,
      totalPaid: Math.round(totalPaid),
    });
  } catch (err) {
    console.error("Mark All Tutor Paid Error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
};

exports.getTutorEarnings = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== "tutor") {
      return res.status(403).json({ error: "Only tutors can view earnings" });
    }

    const payments = await Payment.find({ tutor: user._id, status: "paid" })
      .populate("student", "name email")
      .populate("booking", "subject date day from to status")
      .sort({ createdAt: -1 });

    const mapped = payments.map((payment) => ({
      paymentId: payment._id,
      student: payment.student?.name || "Student",
      subject: payment.booking?.subject,
      date: payment.booking?.date,
      day: payment.booking?.day,
      totalAmount: payment.amount,
      tutorAmount: payment.amount * 0.9,
      adminFee: payment.amount * 0.1,
      tutorPayoutStatus: payment.tutorPayoutStatus,
      tutorPaidAt: payment.tutorPaidAt,
      bookingStatus: payment.booking?.status,
      paidAt: payment.paidAt,
    }));

    const totalEarnings = mapped.reduce((sum, p) => sum + p.tutorAmount, 0);
    const totalPaid = mapped
      .filter((p) => p.tutorPayoutStatus === "paid")
      .reduce((sum, p) => sum + p.tutorAmount, 0);
    const totalUnpaid = mapped
      .filter((p) => p.tutorPayoutStatus === "unpaid")
      .reduce((sum, p) => sum + p.tutorAmount, 0);

    res.status(200).json({ sessions: mapped, totalEarnings, totalPaid, totalUnpaid });
  } catch (err) {
    console.error("Get Tutor Earnings Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.confirmDevPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    if (String(payment.student) !== String(req.user.id)) {
      return res.status(403).json({ error: "You cannot confirm this payment" });
    }

    await markPaymentPaid(payment, { mode: "development-confirmed" });
    res.status(200).json({ message: "Payment confirmed successfully" });
  } catch (err) {
    console.error("Confirm Dev Payment Error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
};

exports.handleEasyPaisaReturn = async (req, res) => {
  try {
    const response = { ...req.body, ...req.query };
    const txnRef = response.pp_TxnRefNo;
    const responseCode = response.pp_ResponseCode;

    const payment = await Payment.findOne({ transactionRef: txnRef });
    if (!payment) return res.status(404).send("Payment not found");

    if (responseCode === "000") {
      await markPaymentPaid(payment, response);
      return res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:5173"}/student_dashboard`,
      );
    }

    payment.status = "failed";
    payment.gatewayResponse = response;
    await payment.save();
    await Booking.findByIdAndUpdate(payment.booking, { paymentStatus: "failed" });

    return res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/tutors?payment=failed`,
    );
  } catch (err) {
    console.error("EasyPaisa Return Error:", err);
    res.status(500).send("Could not process payment response");
  }
};

exports.getAdminPayments = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ error: "Only admin can view payments" });
    }

    const payments = await Payment.find()
      .populate("student", "name email")
      .populate("tutor", "name email")
      .populate("booking", "subject date day from to")
      .sort({ createdAt: -1 });

    res.status(200).json(
      payments.map((payment) => ({
        id: payment._id,
        student: payment.student?.name || "Student",
        tutor: payment.tutor?.name || "Tutor",
        subject: payment.booking?.subject,
        amount: `PKR ${payment.amount}`,
        rawAmount: payment.amount,
        date: payment.createdAt,
        status: payment.status,
        method: payment.method,
        transactionRef: payment.transactionRef,
      })),
    );
  } catch (err) {
    console.error("Get Admin Payments Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
