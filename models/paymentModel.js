const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tutor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    method: { type: String, default: "JazzCash" },
    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    transactionRef: { type: String, unique: true, required: true },
    gatewayResponse: { type: Object },
    paidAt: { type: Date },
  },
  { timestamps: true },
);

const Payment = mongoose.model("Payment", paymentSchema);
module.exports = Payment;
