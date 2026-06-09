const Booking = require("../models/bookingModel");
const Message = require("../models/messageModel");
const Notification = require("../models/notificationModel");
const User = require("../models/userModel");
const { formatTimeRange12, getBookingWindowStatus } = require("../utils/sessionTime");
const { createNotification } = require("../utils/notifications");

const SESSION_CHAT_MESSAGE = "You can only chat during the session.";

const getBookingStartValue = (booking) =>
  `${booking.date || ""} ${booking.from || ""} ${booking.updatedAt?.toISOString?.() || ""}`;

const isBetterConversationBooking = (nextBooking, currentBooking) => {
  if (!currentBooking) return true;

  const nextStatus = getBookingWindowStatus(nextBooking);
  const currentStatus = getBookingWindowStatus(currentBooking);

  if (nextStatus.state === "open" && currentStatus.state !== "open") return true;
  if (nextStatus.state !== "open" && currentStatus.state === "open") return false;

  return getBookingStartValue(nextBooking) > getBookingStartValue(currentBooking);
};

const formatConversation = (booking, userId) => {
  const isStudent = String(booking.student._id) === String(userId);
  const peer = isStudent ? booking.tutor : booking.student;
  return {
    bookingId: booking._id,
    peerId: peer._id,
    name: peer.name,
    email: peer.email,
    profile: peer.profile,
    subject: booking.subject,
    date: booking.date,
    day: booking.day,
    from: booking.from,
    to: booking.to,
    time: formatTimeRange12(booking.from, booking.to),
    chatStatus: getBookingWindowStatus(booking),
  };
};

const getAttachmentType = (attachment = {}) => {
  const mimeType = attachment.mimeType || "";
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType === "application/pdf") return "PDF";
  return "Document";
};

const formatFileSize = (bytes = 0) => {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatMaterial = (message) => ({
  id: message._id,
  name: message.attachment?.name || "Attachment",
  type: getAttachmentType(message.attachment),
  mimeType: message.attachment?.mimeType,
  size: formatFileSize(message.attachment?.size),
  url: message.attachment?.url,
  subject: message.booking?.subject || "Session",
  student: message.receiver?.name || "Student",
  tutor: message.sender?.name || "Tutor",
  uploaded: message.createdAt,
});

const validateChatBooking = async ({ bookingId, senderId, receiverId }) => {
  if (!bookingId) return { error: SESSION_CHAT_MESSAGE };

  const booking = await Booking.findById(bookingId);
  const isParticipant =
    booking &&
    ((String(booking.student) === String(senderId) && String(booking.tutor) === String(receiverId)) ||
      (String(booking.tutor) === String(senderId) && String(booking.student) === String(receiverId)));

  const canUsePaidSession =
    booking?.paymentStatus === "paid" &&
    ["upcoming", "completed"].includes(booking.status);

  if (!isParticipant || !canUsePaidSession) {
    return { error: SESSION_CHAT_MESSAGE };
  }

  const windowStatus = getBookingWindowStatus(booking);
  if (windowStatus.state !== "open") {
    return { error: SESSION_CHAT_MESSAGE };
  }

  return { booking };
};

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

    const conversationsByPeer = new Map();
    bookings.forEach((booking) => {
      const isStudent = String(booking.student._id) === String(userId);
      const peer = isStudent ? booking.tutor : booking.student;
      const peerId = String(peer._id);
      const currentBooking = conversationsByPeer.get(peerId);
      if (isBetterConversationBooking(booking, currentBooking)) {
        conversationsByPeer.set(peerId, booking);
      }
    });

    const conversations = [...conversationsByPeer.values()].map((booking) =>
      formatConversation(booking, userId),
    );

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

exports.uploadMessageAttachment = async (req, res) => {
  try {
    const { peerId } = req.params;
    const { bookingId, classSessionId, text = "" } = req.body;

    if (!req.file) return res.status(400).json({ error: "Please select a file" });

    const { error } = await validateChatBooking({
      bookingId,
      senderId: req.user.id,
      receiverId: peerId,
    });
    if (error) return res.status(403).json({ error });

    const message = await Message.create({
      sender: req.user.id,
      receiver: peerId,
      booking: bookingId,
      classSession: classSessionId || undefined,
      text: text.trim(),
      attachment: {
        url: req.file.path,
        name: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        resourceType: req.file.mimetype?.startsWith("image/") ? "image" : "raw",
      },
      readBy: [req.user.id],
    });

    const populated = await Message.findById(message._id)
      .populate("sender", "name role")
      .populate("receiver", "name role");

    const io = req.app.get("io");
    io?.to(String(peerId)).emit("chat:message", populated);
    io?.to(String(req.user.id)).emit("chat:message", populated);
    await createNotification(io, {
      user: peerId,
      tab: "messages",
      title: "New attachment",
      body: req.file.originalname,
      refId: message._id,
    });

    res.status(201).json({ message: populated });
  } catch (err) {
    console.error("Upload Message Attachment Error:", err);
    res.status(500).json({ error: "Attachment could not be sent" });
  }
};

exports.getMaterials = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("role");
    if (!user) return res.status(404).json({ error: "User not found" });
    const role = user.role;
    const query = {
      "attachment.url": { $exists: true, $ne: "" },
    };

    if (role === "student") {
      query.receiver = userId;
    } else if (role === "tutor") {
      query.sender = userId;
    } else {
      return res.status(403).json({ error: "Only students and tutors can view materials" });
    }

    const messages = await Message.find(query)
      .populate("sender", "name role")
      .populate("receiver", "name role")
      .populate("booking", "subject")
      .sort({ createdAt: -1 });

    const materials = messages
      .filter((message) => message.sender?.role === "tutor")
      .map(formatMaterial)
      .filter((material) => ["PDF", "Video", "Image"].includes(material.type));

    res.status(200).json(materials);
  } catch (err) {
    console.error("Get Materials Error:", err);
    res.status(500).json({ error: "Could not load materials" });
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
