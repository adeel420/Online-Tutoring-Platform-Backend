const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    complainant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    against: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    complainantRole: {
      type: String,
      enum: ["student", "tutor"],
      required: true,
    },
    againstRole: {
      type: String,
      enum: ["student", "tutor"],
      required: true,
    },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "resolved", "warned", "banned"],
      default: "pending",
    },
    adminNote: { type: String },
    actionTakenAt: { type: Date },
    actionTakenBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Complaint", complaintSchema);
