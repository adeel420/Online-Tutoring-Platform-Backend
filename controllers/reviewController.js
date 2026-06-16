const Booking = require("../models/bookingModel");
const Review = require("../models/reviewModel");
const User = require("../models/userModel");

const formatReview = (review) => ({
  id: review._id,
  studentId: review.student?._id,
  student: review.student?.name || "Student",
  tutorId: review.tutor?._id,
  tutor: review.tutor?.name || "Tutor",
  rating: review.rating,
  review: review.review,
  date: review.createdAt,
  updatedAt: review.updatedAt,
});

exports.createOrUpdateReview = async (req, res) => {
  try {
    const { tutorId } = req.params;
    const { rating, review = "", bookingId } = req.body;
    const ratingNumber = Number(rating);

    if (!Number.isInteger(ratingNumber) || ratingNumber < 1 || ratingNumber > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5 stars" });
    }

    if (!bookingId) {
      return res.status(400).json({ error: "Booking ID is required" });
    }

    const student = await User.findById(req.user.id);
    if (!student) return res.status(404).json({ error: "Student not found" });
    if (student.role !== "student") {
      return res.status(403).json({ error: "Only students can review tutors" });
    }

    const tutor = await User.findById(tutorId);
    if (!tutor || tutor.role !== "tutor") {
      return res.status(404).json({ error: "Tutor not found" });
    }

    const completedBooking = await Booking.findOne({
      _id: bookingId,
      student: student._id,
      tutor: tutor._id,
      paymentStatus: "paid",
      status: "completed",
    });

    if (!completedBooking) {
      return res.status(403).json({
        error: "You can review this session only after it is completed and paid.",
      });
    }

    const savedReview = await Review.findOneAndUpdate(
      { student: student._id, booking: completedBooking._id },
      {
        student: student._id,
        tutor: tutor._id,
        booking: completedBooking._id,
        rating: ratingNumber,
        review: String(review).trim(),
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    )
      .populate("student", "name")
      .populate("tutor", "name");

    res.status(200).json({
      message: "Review saved successfully",
      review: formatReview(savedReview),
    });
  } catch (err) {
    console.error("Save Review Error:", err);
    res.status(500).json({ error: "Could not save review" });
  }
};

exports.getReviews = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("role");
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Only admin can view all reviews" });
    }

    const reviews = await Review.find()
      .populate("student", "name")
      .populate("tutor", "name")
      .sort({ createdAt: -1 });

    res.status(200).json(reviews.map(formatReview));
  } catch (err) {
    console.error("Get Reviews Error:", err);
    res.status(500).json({ error: "Could not load reviews" });
  }
};
