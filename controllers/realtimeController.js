const Booking = require("../models/bookingModel");
const Message = require("../models/messageModel");
const Notification = require("../models/notificationModel");
const { formatTimeRange12 } = require("../utils/sessionTime");

exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const bookings = await Booking.find({
      $or: [{ student: userId }, { tutor: userId }],
      paymentStatus: "paid",
    })
      .populate("student", "name email profile")
      .populate("tutor", "name email profile")
      .sort({ updatedAt: -1 });

    const conversations = bookings.map((booking) => {
      const isStudent = String(booking.student._id) === String(userId);
      const peer = isStudent ? booking.tutor : booking.student;
      return {
        bookingId: booking._id,
        peerId: peer._id,
        name: peer.name,
        email: peer.email,
        profile: peer.profile,
        subject: booking.subject,
        day: booking.day,
        time: formatTimeRange12(booking.from, booking.to),
      };
    });

    res.status(200).json(conversations);
  } catch (err) {
    console.error("Get Conversations Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { peerId } = req.params;
    const { bookingId, classSessionId } = req.query;
    const query = {
      $or: [
        { sender: req.user.id, receiver: peerId },
        { sender: peerId, receiver: req.user.id },
      ],
    };

    if (bookingId) query.booking = bookingId;
    if (classSessionId) query.classSession = classSessionId;

    const messages = await Message.find(query)
      .populate("sender", "name role")
      .populate("receiver", "name role")
      .sort({ createdAt: 1 });

    await Message.updateMany(
      { ...query, receiver: req.user.id, readBy: { $ne: req.user.id } },
      { $addToSet: { readBy: req.user.id } },
    );

    res.status(200).json(messages);
  } catch (err) {
    console.error("Get Messages Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100);

    const summary = notifications.reduce((acc, notification) => {
      if (!notification.read) {
        acc[notification.tab] = (acc[notification.tab] || 0) + 1;
      }
      return acc;
    }, {});

    res.status(200).json({ notifications, summary });
  } catch (err) {
    console.error("Get Notifications Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.markTabSeen = async (req, res) => {
  try {
    const { tab } = req.params;
    await Notification.updateMany(
      { user: req.user.id, tab, read: false },
      { read: true },
    );

    const unread = await Notification.aggregate([
      { $match: { user: require("mongoose").Types.ObjectId.createFromHexString(req.user.id), read: false } },
      { $group: { _id: "$tab", count: { $sum: 1 } } },
    ]);
    const summary = unread.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    res.status(200).json({ summary });
  } catch (err) {
    console.error("Mark Tab Seen Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
