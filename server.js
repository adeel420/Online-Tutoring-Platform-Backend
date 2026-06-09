const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
require("dotenv").config();
const db = require("./db");
const userRoutes = require("./routes/UserRoutes");
const paymentRoutes = require("./routes/PaymentRoutes");
const classSessionRoutes = require("./routes/ClassSessionRoutes");
const realtimeRoutes = require("./routes/RealtimeRoutes");
const reviewRoutes = require("./routes/ReviewRoutes");
const Booking = require("./models/bookingModel");
const Message = require("./models/messageModel");
const { createNotification } = require("./utils/notifications");
const { getBookingWindowStatus } = require("./utils/sessionTime");
const passport = require("./config/passport");
const cors = require("cors");

// Packages
app.use(cors());
const PORT = process.env.PORT || 8080;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT"],
  },
});
app.set("io", io);
global.io = io;

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = verified.id;
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  socket.join(String(socket.userId));

  socket.on("chat:send", async (payload = {}, ack) => {
    try {
      const { to, text, bookingId, classSessionId } = payload;
      if (!to || !text?.trim()) return;
      if (!bookingId) {
        ack?.({ ok: false, error: "You can only chat during the session." });
        return;
      }

      const booking = await Booking.findById(bookingId);
      const isParticipant =
        booking &&
        ((String(booking.student) === String(socket.userId) &&
          String(booking.tutor) === String(to)) ||
          (String(booking.tutor) === String(socket.userId) &&
            String(booking.student) === String(to)));

      const canUsePaidSession =
        booking?.paymentStatus === "paid" &&
        ["upcoming", "completed"].includes(booking.status);

      if (!isParticipant || !canUsePaidSession) {
        ack?.({ ok: false, error: "You can only chat during the session." });
        return;
      }

      const windowStatus = getBookingWindowStatus(booking);
      if (windowStatus.state !== "open") {
        ack?.({ ok: false, error: "You can only chat during the session." });
        return;
      }

      const message = await Message.create({
        sender: socket.userId,
        receiver: to,
        booking: bookingId || undefined,
        classSession: classSessionId || undefined,
        text: text.trim(),
        readBy: [socket.userId],
      });
      const populated = await Message.findById(message._id)
        .populate("sender", "name role")
        .populate("receiver", "name role");

      io.to(String(to)).emit("chat:message", populated);
      io.to(String(socket.userId)).emit("chat:message", populated);
      await createNotification(io, {
        user: to,
        tab: "messages",
        title: "New message",
        body: text.trim(),
        refId: message._id,
      });
      ack?.({ ok: true, message: populated });
    } catch (err) {
      console.error("Socket Chat Error:", err);
      ack?.({ ok: false, error: "Message could not be sent" });
    }
  });
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(passport.initialize());
const authMiddleware = passport.authenticate("local", { session: false });

// Routes
app.use("/user", userRoutes);
app.use("/payment", paymentRoutes);
app.use("/class-sessions", classSessionRoutes);
app.use("/realtime", realtimeRoutes);
app.use("/reviews", reviewRoutes);

server.listen(PORT, () => {
  console.log(`Listening the port ${PORT}`);
});
