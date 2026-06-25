// =============================================
// SEED DATA SCRIPT - TutorConnect Platform
// =============================================
// Usage: node seed.js
// Make sure MONGO_URL is set in your .env file
// =============================================

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();

// ---- Connect to MongoDB ----
mongoose.connect(process.env.MONGO_URL);
const db = mongoose.connection;
db.on("connected", () => console.log("✅ Connected to MongoDB"));
db.on("error", (err) => console.error("❌ MongoDB Error:", err));

// ---- Inline Schemas (same as your models) ----

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: String,
    phone: String,
    profile: String,
    role: {
      type: String,
      enum: ["student", "tutor", "admin"],
      default: "student",
    },
    subject: String,
    experience: String,
    rate: String,
    qualification: String,
    bio: String,
    location: String,
    tags: [String],
    available: { type: Boolean, default: true },
    availabilitySlots: [
      {
        date: String,
        day: String,
        from: String,
        to: String,
        isBooked: { type: Boolean, default: false },
      },
    ],
    cnic: String,
    experienceLetter: String,
    bankDetails: {
      bankName: String,
      accountTitle: String,
      accountNumber: String,
      iban: String,
    },
    isApproved: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    verificationCode: String,
    resetPasswordOTP: String,
    resetPasswordExpires: Date,
  },
  { timestamps: true },
);

const bookingSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    tutor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    slotId: mongoose.Schema.Types.ObjectId,
    date: String,
    day: String,
    from: String,
    to: String,
    subject: String,
    rate: String,
    amount: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    paymentMethod: { type: String, default: "EasyPaisa" },
    paymentReference: String,
    paidAt: Date,
    status: {
      type: String,
      enum: ["pending_payment", "upcoming", "completed", "cancelled"],
      default: "pending_payment",
    },
  },
  { timestamps: true },
);

const paymentSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    tutor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    amount: Number,
    method: { type: String, default: "EasyPaisa" },
    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    transactionRef: { type: String, unique: true },
    gatewayResponse: Object,
    paidAt: Date,
  },
  { timestamps: true },
);

const reviewSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    tutor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String, default: "" },
  },
  { timestamps: true },
);

const complaintSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    complainant: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    against: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    complainantRole: { type: String, enum: ["student", "tutor"] },
    againstRole: { type: String, enum: ["student", "tutor"] },
    subject: String,
    message: String,
    status: {
      type: String,
      enum: ["pending", "resolved", "warned", "banned"],
      default: "pending",
    },
    adminNote: String,
    actionTakenAt: Date,
    actionTakenBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

const messageSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    classSession: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSession" },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: { type: String, default: "" },
    attachment: {
      url: String,
      name: String,
      mimeType: String,
      size: Number,
      resourceType: String,
    },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    tab: String,
    title: String,
    body: String,
    refId: mongoose.Schema.Types.ObjectId,
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const classSessionSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      unique: true,
    },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    tutor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["waiting", "live", "ended"],
      default: "waiting",
    },
    offer: Object,
    answer: Object,
    candidates: [],
    startedAt: Date,
    endedAt: Date,
  },
  { timestamps: true },
);

// ---- Register Models ----
const User = mongoose.model("User", userSchema);
const Booking = mongoose.model("Booking", bookingSchema);
const Payment = mongoose.model("Payment", paymentSchema);
const Review = mongoose.model("Review", reviewSchema);
const Complaint = mongoose.model("Complaint", complaintSchema);
const Message = mongoose.model("Message", messageSchema);
const Notification = mongoose.model("Notification", notificationSchema);
const ClassSession = mongoose.model("ClassSession", classSessionSchema);

// =============================================
// MAIN SEED FUNCTION
// =============================================
async function seedDatabase() {
  try {
    // ---- Clear existing data ----
    console.log("\n🗑️  Clearing old seed data...");
    await Promise.all([
      User.deleteMany({}),
      Booking.deleteMany({}),
      Payment.deleteMany({}),
      Review.deleteMany({}),
      Complaint.deleteMany({}),
      Message.deleteMany({}),
      Notification.deleteMany({}),
      ClassSession.deleteMany({}),
    ]);
    console.log("✅ Old data cleared\n");

    const hashedPassword = await bcrypt.hash("Test1234!", 10);

    // =============================================
    // 1. USERS
    // =============================================

    // --- Admin ---
    const admin = await User.create({
      name: "Admin User",
      email: "admin@tutorconnect.com",
      password: hashedPassword,
      phone: "03001234567",
      role: "admin",
      isVerified: true,
      isApproved: true,
      location: "Lahore",
    });

    // --- Tutors ---
    const tutorsData = [
      {
        name: "Ali Raza",
        email: "ali.tutor@gmail.com",
        phone: "03111234567",
        subject: "Mathematics",
        experience: "5 years",
        rate: "1500",
        qualification: "BS Mathematics - LUMS",
        bio: "Experienced math tutor specializing in O/A Levels and university calculus.",
        location: "Lahore",
        tags: ["Mathematics", "Calculus", "Statistics", "O-Levels", "A-Levels"],
        isApproved: true,
        cnic: "35202-1234567-1",
        bankDetails: {
          bankName: "Meezan Bank",
          accountTitle: "Ali Raza",
          accountNumber: "01320123456789",
          iban: "PK36MEZN0001320123456789",
        },
        availabilitySlots: [
          { day: "Monday", from: "10:00", to: "11:00", isBooked: false },
          { day: "Monday", from: "14:00", to: "15:00", isBooked: false },
          { day: "Wednesday", from: "10:00", to: "11:00", isBooked: false },
          { day: "Friday", from: "15:00", to: "16:00", isBooked: false },
        ],
      },
      {
        name: "Sara Khan",
        email: "sara.tutor@gmail.com",
        phone: "03211234567",
        subject: "Physics",
        experience: "3 years",
        rate: "1200",
        qualification: "MS Physics - QAU",
        bio: "Physics teacher with a knack for making complex concepts simple and fun.",
        location: "Islamabad",
        tags: ["Physics", "Mechanics", "Electromagnetism", "A-Levels"],
        isApproved: true,
        cnic: "61101-9876543-2",
        bankDetails: {
          bankName: "HBL",
          accountTitle: "Sara Khan",
          accountNumber: "00427654321001",
          iban: "PK06HABB0000427654321001",
        },
        availabilitySlots: [
          { day: "Tuesday", from: "09:00", to: "10:00", isBooked: false },
          { day: "Thursday", from: "11:00", to: "12:00", isBooked: false },
          { day: "Saturday", from: "13:00", to: "14:00", isBooked: false },
        ],
      },
      {
        name: "Usman Farooq",
        email: "usman.tutor@gmail.com",
        phone: "03331234567",
        subject: "English",
        experience: "7 years",
        rate: "1000",
        qualification: "MA English Literature - PU",
        bio: "Helping students master IELTS, spoken English, and academic writing.",
        location: "Lahore",
        tags: ["English", "IELTS", "Academic Writing", "Grammar"],
        isApproved: true,
        cnic: "35302-1122334-3",
        bankDetails: {
          bankName: "UBL",
          accountTitle: "Usman Farooq",
          accountNumber: "1234500001122",
          iban: "PK24UNIL0010001234500001",
        },
        availabilitySlots: [
          { day: "Monday", from: "16:00", to: "17:00", isBooked: false },
          { day: "Wednesday", from: "16:00", to: "17:00", isBooked: false },
          { day: "Friday", from: "10:00", to: "11:00", isBooked: false },
        ],
      },
    ];

    const tutors = [];
    for (const t of tutorsData) {
      const tutor = await User.create({
        ...t,
        password: hashedPassword,
        role: "tutor",
        isVerified: true,
      });
      tutors.push(tutor);
    }

    // --- Students ---
    const studentsData = [
      {
        name: "Fatima Malik",
        email: "fatima.student@gmail.com",
        phone: "03451234567",
        location: "Lahore",
      },
      {
        name: "Hassan Ahmed",
        email: "hassan.student@gmail.com",
        phone: "03561234567",
        location: "Karachi",
      },
      {
        name: "Zainab Noor",
        email: "zainab.student@gmail.com",
        phone: "03671234567",
        location: "Islamabad",
      },
    ];

    const students = [];
    for (const s of studentsData) {
      const student = await User.create({
        ...s,
        password: hashedPassword,
        role: "student",
        isVerified: true,
      });
      students.push(student);
    }

    console.log(
      `✅ Created: 1 admin, ${tutors.length} tutors, ${students.length} students`,
    );

    // =============================================
    // 2. BOOKINGS
    // =============================================
    const slotId1 = new mongoose.Types.ObjectId();
    const slotId2 = new mongoose.Types.ObjectId();
    const slotId3 = new mongoose.Types.ObjectId();

    const bookingsData = [
      // Completed + Paid
      {
        student: students[0]._id,
        tutor: tutors[0]._id,
        slotId: slotId1,
        date: "2026-06-10",
        day: "Wednesday",
        from: "10:00",
        to: "11:00",
        subject: "Mathematics",
        rate: "1500",
        amount: 1500,
        paymentStatus: "paid",
        paymentReference: "JC-2026-001",
        paidAt: new Date("2026-06-09"),
        status: "completed",
      },
      // Upcoming + Paid
      {
        student: students[1]._id,
        tutor: tutors[1]._id,
        slotId: slotId2,
        date: "2026-07-01",
        day: "Tuesday",
        from: "09:00",
        to: "10:00",
        subject: "Physics",
        rate: "1200",
        amount: 1200,
        paymentStatus: "paid",
        paymentReference: "JC-2026-002",
        paidAt: new Date("2026-06-25"),
        status: "upcoming",
      },
      // Pending Payment
      {
        student: students[2]._id,
        tutor: tutors[2]._id,
        slotId: slotId3,
        date: "2026-07-05",
        day: "Sunday",
        from: "16:00",
        to: "17:00",
        subject: "English",
        rate: "1000",
        amount: 1000,
        paymentStatus: "pending",
        status: "pending_payment",
      },
      // Cancelled
      {
        student: students[0]._id,
        tutor: tutors[2]._id,
        slotId: new mongoose.Types.ObjectId(),
        date: "2026-06-15",
        day: "Monday",
        from: "16:00",
        to: "17:00",
        subject: "English",
        rate: "1000",
        amount: 1000,
        paymentStatus: "failed",
        status: "cancelled",
      },
    ];

    const bookings = await Booking.insertMany(bookingsData);
    console.log(`✅ Created: ${bookings.length} bookings`);

    // =============================================
    // 3. PAYMENTS
    // =============================================
    const payments = await Payment.insertMany([
      {
        booking: bookings[0]._id,
        student: students[0]._id,
        tutor: tutors[0]._id,
        amount: 1500,
        method: "EasyPaisa",
        status: "paid",
        transactionRef: "EP-2026-001",
        gatewayResponse: { code: "000", message: "SUCCESS" },
        paidAt: new Date("2026-06-09"),
      },
      {
        booking: bookings[1]._id,
        student: students[1]._id,
        tutor: tutors[1]._id,
        amount: 1200,
        method: "EasyPaisa",
        status: "paid",
        transactionRef: "EP-2026-002",
        gatewayResponse: { code: "000", message: "SUCCESS" },
        paidAt: new Date("2026-06-25"),
      },
    ]);
    console.log(`✅ Created: ${payments.length} payments`);

    // =============================================
    // 4. REVIEWS
    // =============================================
    const reviews = await Review.insertMany([
      {
        student: students[0]._id,
        tutor: tutors[0]._id,
        booking: bookings[0]._id,
        rating: 5,
        review:
          "Ali bhai ne bohat acha padhaya! Calculus ab bilkul clear ho gaya.",
      },
      {
        student: students[1]._id,
        tutor: tutors[1]._id,
        booking: bookings[1]._id,
        rating: 4,
        review: "Sara madam are very patient and explain topics thoroughly.",
      },
    ]);
    console.log(`✅ Created: ${reviews.length} reviews`);

    // =============================================
    // 5. COMPLAINTS
    // =============================================
    const complaints = await Complaint.insertMany([
      {
        booking: bookings[0]._id,
        complainant: students[0]._id,
        against: tutors[0]._id,
        complainantRole: "student",
        againstRole: "tutor",
        subject: "Session started late",
        message:
          "Tutor joined the session 15 minutes late without any notice. Please address this.",
        status: "pending",
      },
      {
        booking: bookings[1]._id,
        complainant: tutors[1]._id,
        against: students[1]._id,
        complainantRole: "tutor",
        againstRole: "student",
        subject: "Disrespectful behavior",
        message:
          "Student was rude during the session and used inappropriate language.",
        status: "resolved",
        adminNote: "Warning issued to student. Monitoring future sessions.",
        actionTakenAt: new Date("2026-06-20"),
        actionTakenBy: admin._id,
      },
    ]);
    console.log(`✅ Created: ${complaints.length} complaints`);

    // =============================================
    // 6. MESSAGES
    // =============================================
    const messages = await Message.insertMany([
      {
        booking: bookings[0]._id,
        sender: students[0]._id,
        receiver: tutors[0]._id,
        text: "Assalam o Alaikum! Kya aap kal ke session mein integration cover karenge?",
        readBy: [students[0]._id, tutors[0]._id],
      },
      {
        booking: bookings[0]._id,
        sender: tutors[0]._id,
        receiver: students[0]._id,
        text: "Wa Alaikum Assalam! Haan, hum integration aur uske applications cover karenge.",
        readBy: [tutors[0]._id],
      },
      {
        booking: bookings[1]._id,
        sender: students[1]._id,
        receiver: tutors[1]._id,
        text: "Ma'am can you send the notes from today's session?",
        readBy: [students[1]._id],
      },
    ]);
    console.log(`✅ Created: ${messages.length} messages`);

    // =============================================
    // 7. CLASS SESSION (for completed booking)
    // =============================================
    const classSessions = await ClassSession.insertMany([
      {
        booking: bookings[0]._id,
        student: students[0]._id,
        tutor: tutors[0]._id,
        status: "ended",
        startedAt: new Date("2026-06-10T10:02:00Z"),
        endedAt: new Date("2026-06-10T11:00:00Z"),
      },
    ]);
    console.log(`✅ Created: ${classSessions.length} class session(s)`);

    // =============================================
    // 8. NOTIFICATIONS
    // =============================================
    const notifications = await Notification.insertMany([
      {
        user: students[0]._id,
        tab: "bookings",
        title: "Booking Confirmed",
        body: "Your session with Ali Raza on June 10 is confirmed.",
        refId: bookings[0]._id,
        read: true,
      },
      {
        user: tutors[0]._id,
        tab: "bookings",
        title: "New Booking Received",
        body: "Fatima Malik has booked a session with you.",
        refId: bookings[0]._id,
        read: false,
      },
      {
        user: students[1]._id,
        tab: "payments",
        title: "Payment Successful",
        body: "Payment of Rs. 1200 for Physics session confirmed.",
        refId: payments[1]._id,
        read: false,
      },
      {
        user: admin._id,
        tab: "complaints",
        title: "New Complaint Filed",
        body: "A student filed a complaint against tutor Ali Raza.",
        refId: complaints[0]._id,
        read: false,
      },
    ]);
    console.log(`✅ Created: ${notifications.length} notifications`);

    // =============================================
    // SUMMARY
    // =============================================
    console.log("\n🎉 Seed completed successfully!\n");
    console.log("=".repeat(50));
    console.log("📋 LOGIN CREDENTIALS (password: Test1234!)");
    console.log("=".repeat(50));
    console.log("👤 ADMIN:    admin@tutorconnect.com");
    console.log("📚 TUTORS:   ali.tutor@gmail.com");
    console.log("             sara.tutor@gmail.com");
    console.log("             usman.tutor@gmail.com");
    console.log("🎓 STUDENTS: fatima.student@gmail.com");
    console.log("             hassan.student@gmail.com");
    console.log("             zainab.student@gmail.com");
    console.log("=".repeat(50));
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

// Run
db.once("open", seedDatabase);
