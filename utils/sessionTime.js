const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Asia/Karachi";

const toMinutes = (time = "") => {
  const [hours, minutes] = String(time).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const formatTime12 = (time = "") => {
  const minutesFromMidnight = toMinutes(time);
  if (minutesFromMidnight === null) return time;

  const hours24 = Math.floor(minutesFromMidnight / 60);
  const minutes = minutesFromMidnight % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;

  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
};

const formatTimeRange12 = (from, to) => `${formatTime12(from)} - ${formatTime12(to)}`;

const getZonedNow = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(now);

  const value = (type) => parts.find((part) => part.type === type)?.value;

  return {
    day: value("weekday"),
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minutes: Number(value("hour")) * 60 + Number(value("minute")),
    seconds: Number(value("second")) || 0,
  };
};

const getDayFromDate = (date = "") => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return "";
  const [year, month, day] = String(date).split("-").map(Number);
  return DAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
};

const getTodayDate = (now = new Date()) => getZonedNow(now).date;

const getBookingWindowStatus = (booking, now = new Date()) => {
  const startMinutes = toMinutes(booking.from);
  const endMinutes = toMinutes(booking.to);

  if (startMinutes === null || endMinutes === null) {
    return { state: "invalid", message: "Booking time is invalid" };
  }

  const zonedNow = getZonedNow(now);
  const currentDay = zonedNow.day || DAYS[now.getDay()];
  if (booking.date && booking.date !== zonedNow.date) {
    return {
      state: booking.date < zonedNow.date ? "expired" : "early",
      message: `This class can only start on ${booking.date} at ${formatTime12(booking.from)}.`,
    };
  }

  if (!booking.date && booking.day !== currentDay) {
    return {
      state: "early",
      message: `This class can only start on ${booking.day} at ${formatTime12(booking.from)}.`,
    };
  }

  const currentMinutes = zonedNow.minutes;
  if (currentMinutes < startMinutes) {
    return {
      state: "early",
      message: `This class will open at ${formatTime12(booking.from)}.`,
    };
  }

  if (currentMinutes >= endMinutes) {
    return {
      state: "expired",
      message: "This class time has ended.",
    };
  }

  return {
    state: "open",
    remainingMs: (endMinutes - currentMinutes) * 60 * 1000 - zonedNow.seconds * 1000,
  };
};

module.exports = {
  formatTime12,
  formatTimeRange12,
  getDayFromDate,
  getTodayDate,
  getBookingWindowStatus,
};
