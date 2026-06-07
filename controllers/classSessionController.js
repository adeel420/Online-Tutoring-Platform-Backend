const Booking = require("../models/bookingModel");
const ClassSession = require("../models/classSessionModel");
const { createNotification } = require("../utils/notifications");
const { getBookingWindowStatus } = require("../utils/sessionTime");

const populateSession = (query) =>
  query
    .populate("student", "name email profile")
    .populate("tutor", "name email profile")
    .populate("booking");

const canUseBooking = (booking, user) => {
  const userId = String(user.id);
  return String(booking.student) === userId || String(booking.tutor) === userId;
};

const requireClassParticipant = async (sessionId, userId) => {
  const session = await ClassSession.findById(sessionId);
  if (!session) return { error: { status: 404, message: "Class session not found" } };

  const allowed =
    String(session.student) === String(userId) ||
    String(session.tutor) === String(userId);

  if (!allowed) {
    return { error: { status: 403, message: "You are not part of this class" } };
  }

  return { session };
};

const completeBooking = async (bookingId) => {
  if (!bookingId) return;
  await Booking.updateOne(
    { _id: bookingId, status: { $ne: "completed" } },
    { $set: { status: "completed" } },
  );
};

const endExpiredSession = async (session) => {
  const booking = session.booking?._id ? session.booking : await Booking.findById(session.booking);
  if (!booking) return { expired: false };

  const windowStatus = getBookingWindowStatus(booking);
  if (windowStatus.state !== "expired") return { expired: false, booking };

  const endedAt = new Date();
  const updatedSession = await ClassSession.findByIdAndUpdate(
    session._id,
    { $set: { status: "ended", endedAt } },
    { new: true, runValidators: true },
  );
  await completeBooking(booking._id);

  return { expired: true, session: updatedSession, booking };
};

exports.createOrGetClassSession = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId);

    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (!canUseBooking(booking, req.user)) {
      return res.status(403).json({ error: "You are not part of this booking" });
    }
    if (booking.paymentStatus !== "paid" || booking.status === "pending_payment") {
      return res.status(400).json({ error: "Payment is required before class starts" });
    }
    if (booking.status === "completed" || booking.status === "cancelled") {
      return res.status(400).json({ error: "This class is no longer available" });
    }

    const windowStatus = getBookingWindowStatus(booking);
    if (windowStatus.state === "expired") {
      await completeBooking(booking._id);
      return res.status(400).json({ error: windowStatus.message });
    }
    if (windowStatus.state !== "open") {
      return res.status(400).json({ error: windowStatus.message });
    }

    const session = await ClassSession.findOneAndUpdate(
      { booking: booking._id },
      {
        $setOnInsert: {
          booking: booking._id,
          student: booking.student,
          tutor: booking.tutor,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    const populated = await populateSession(ClassSession.findById(session._id));
    res.status(200).json(populated);
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.booking) {
      try {
        const session = await ClassSession.findOne({
          booking: req.params.bookingId,
        });
        const populated = await populateSession(ClassSession.findById(session._id));
        return res.status(200).json(populated);
      } catch (lookupErr) {
        console.error("Duplicate Class Session Lookup Error:", lookupErr);
      }
    }

    console.error("Create Class Session Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getClassSession = async (req, res) => {
  try {
    const { session, error } = await requireClassParticipant(
      req.params.sessionId,
      req.user.id,
    );
    if (error) return res.status(error.status).json({ error: error.message });

    const expired = await endExpiredSession(session);
    const populated = await populateSession(
      ClassSession.findById(expired.session?._id || session._id),
    );
    res.status(200).json(populated);
  } catch (err) {
    console.error("Get Class Session Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.saveOffer = async (req, res) => {
  try {
    const { session, error } = await requireClassParticipant(
      req.params.sessionId,
      req.user.id,
    );
    if (error) return res.status(error.status).json({ error: error.message });
    if (String(session.tutor) !== String(req.user.id)) {
      return res.status(403).json({ error: "Only tutor can start the class" });
    }
    const booking = await Booking.findById(session.booking);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    const windowStatus = getBookingWindowStatus(booking);
    if (windowStatus.state === "expired") {
      await completeBooking(booking._id);
      await ClassSession.updateOne(
        { _id: session._id },
        { $set: { status: "ended", endedAt: new Date() } },
      );
      return res.status(400).json({ error: windowStatus.message });
    }
    if (windowStatus.state !== "open") {
      return res.status(400).json({ error: windowStatus.message });
    }

    const updatedSession = await ClassSession.findOneAndUpdate(
      { _id: session._id, tutor: req.user.id },
      {
        $set: {
          offer: req.body.offer,
          candidates: [],
          status: "waiting",
          startedAt: session.startedAt || new Date(),
        },
        $unset: { answer: "" },
      },
      { new: true, runValidators: true },
    );
    if (!updatedSession) {
      return res.status(404).json({ error: "Class session not found" });
    }

    await createNotification(req.app.get("io"), {
      user: updatedSession.student,
      tab: "sessions",
      title: "Class started",
      body: "Your tutor has started the live class.",
      refId: updatedSession._id,
    });

    res.status(200).json({ message: "Offer saved", session: updatedSession });
  } catch (err) {
    console.error("Save Offer Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.saveAnswer = async (req, res) => {
  try {
    const { session, error } = await requireClassParticipant(
      req.params.sessionId,
      req.user.id,
    );
    if (error) return res.status(error.status).json({ error: error.message });
    if (String(session.student) !== String(req.user.id)) {
      return res.status(403).json({ error: "Only student can join the class" });
    }
    if (!session.offer) {
      return res.status(400).json({ error: "Tutor has not started this class yet" });
    }
    const expired = await endExpiredSession(session);
    if (expired.expired) {
      return res.status(400).json({ error: "This class time has ended." });
    }

    const updatedSession = await ClassSession.findOneAndUpdate(
      { _id: session._id, student: req.user.id, offer: { $exists: true, $ne: null } },
      { $set: { answer: req.body.answer, status: "live" } },
      { new: true, runValidators: true },
    );
    if (!updatedSession) {
      return res.status(400).json({ error: "Tutor has not started this class yet" });
    }

    res.status(200).json({ message: "Answer saved", session: updatedSession });
  } catch (err) {
    console.error("Save Answer Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.addCandidate = async (req, res) => {
  try {
    const { session, error } = await requireClassParticipant(
      req.params.sessionId,
      req.user.id,
    );
    if (error) return res.status(error.status).json({ error: error.message });
    const expired = await endExpiredSession(session);
    if (expired.expired) {
      return res.status(400).json({ error: "This class time has ended." });
    }

    if (req.body.candidate) {
      await ClassSession.updateOne(
        { _id: session._id },
        {
          $push: {
            candidates: {
              sender: req.user.id,
              candidate: req.body.candidate,
            },
          },
        },
        { runValidators: true },
      );
    }

    res.status(200).json({ message: "Candidate saved" });
  } catch (err) {
    console.error("Add Candidate Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.endClassSession = async (req, res) => {
  try {
    const { session, error } = await requireClassParticipant(
      req.params.sessionId,
      req.user.id,
    );
    if (error) return res.status(error.status).json({ error: error.message });

    session.status = "ended";
    session.endedAt = new Date();
    const updatedSession = await ClassSession.findByIdAndUpdate(
      session._id,
      { $set: { status: "ended", endedAt: session.endedAt } },
      { new: true, runValidators: true },
    );
    if (!updatedSession) {
      return res.status(404).json({ error: "Class session not found" });
    }
    await completeBooking(session.booking);

    const receiver =
      String(session.student) === String(req.user.id) ? session.tutor : session.student;
    await createNotification(req.app.get("io"), {
      user: receiver,
      tab: "sessions",
      title: "Class ended",
      body: "The live class has ended.",
      refId: session._id,
    });

    res.status(200).json({ message: "Class ended", session: updatedSession });
  } catch (err) {
    console.error("End Class Session Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
