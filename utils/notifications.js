const Notification = require("../models/notificationModel");

const emitToUser = (reqOrIo, userId, event, payload) => {
  const io = reqOrIo?.app?.get?.("io") || reqOrIo;
  io?.to?.(String(userId)).emit(event, payload);
};

const createNotification = async (io, { user, tab, title, body, refId }) => {
  const notification = await Notification.create({
    user,
    tab,
    title,
    body,
    refId,
  });

  emitToUser(io, user, "notification:new", notification);
  return notification;
};

module.exports = { createNotification, emitToUser };
