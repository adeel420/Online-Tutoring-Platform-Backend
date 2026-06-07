const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  profile: { type: String },
  role: { type: String, enum: ["student", "tutor", "admin"], default: "student" },
  subject: { type: String },
  experience: { type: String },
  rate: { type: String },
  qualification: { type: String },
  bio: { type: String },
  location: { type: String },
  tags: [{ type: String }],
  available: { type: Boolean, default: true },
  availabilitySlots: [
    {
      day: { type: String, required: true },
      from: { type: String, required: true },
      to: { type: String, required: true },
      isBooked: { type: Boolean, default: false },
    },
  ],
  cnic: { type: String },
  experienceLetter: { type: String },
  bankDetails: {
    bankName: { type: String },
    accountTitle: { type: String },
    accountNumber: { type: String },
    iban: { type: String },
  },
  isApproved: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  verificationCode: String,
  resetPasswordOTP: String,
  resetPasswordExpires: Date,
}, { timestamps: true });

// Hash password before saving (only if modified)
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const saltRounds = 10;
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
module.exports = User;
