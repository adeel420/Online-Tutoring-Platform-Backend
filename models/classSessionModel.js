const mongoose = require("mongoose");

const signalSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    candidate: { type: Object, required: true },
  },
  { timestamps: true },
);

const classSessionSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
    },
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
    status: {
      type: String,
      enum: ["waiting", "live", "ended"],
      default: "waiting",
    },
    offer: { type: Object },
    answer: { type: Object },
    candidates: [signalSchema],
    startedAt: { type: Date },
    endedAt: { type: Date },
  },
  { timestamps: true },
);

const ClassSession = mongoose.model("ClassSession", classSessionSchema);
module.exports = ClassSession;
