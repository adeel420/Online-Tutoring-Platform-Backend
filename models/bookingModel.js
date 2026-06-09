const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tutor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    slotId: { type: mongoose.Schema.Types.ObjectId, required: true },
    date: { type: String },
    day: { type: String, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    subject: { type: String },
    rate: { type: String },
    amount: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    paymentMethod: { type: String, default: "JazzCash" },
    paymentReference: { type: String },
    paidAt: { type: Date },
    status: {
      type: String,
      enum: ["pending_payment", "upcoming", "completed", "cancelled"],
      default: "pending_payment",
    },
  },
  { timestamps: true },
);

const Booking = mongoose.model("Booking", bookingSchema);
module.exports = Booking;
