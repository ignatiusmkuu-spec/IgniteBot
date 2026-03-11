const db = require("./datastore");

let _config = null;
function getConfig() {
  if (!_config) _config = require("../config");
  return _config;
}

const DEFAULTS = { bookings: [], nextId: 1 };

function getAvailableServices() {
  return getConfig().defaultServices;
}

function book(jid, service, date, time) {
  const services = getAvailableServices();
  const serviceIndex = parseInt(service, 10) - 1;
  const serviceName = services[serviceIndex] || service;

  let booking = null;
  db.update("bookings", DEFAULTS, (data) => {
    const id = data.nextId++;
    booking = {
      id,
      user: jid,
      service: serviceName,
      date,
      time,
      status: "confirmed",
      createdAt: new Date().toISOString(),
    };
    data.bookings.push(booking);
  });
  return booking;
}

function getUserBookings(jid) {
  const data = db.read("bookings", DEFAULTS);
  return data.bookings.filter((b) => b.user === jid);
}

function cancelBooking(jid, bookingId) {
  let found = false;
  db.update("bookings", DEFAULTS, (data) => {
    const b = data.bookings.find(
      (b) => b.id === Number(bookingId) && b.user === jid
    );
    if (b) {
      b.status = "cancelled";
      found = true;
    }
  });
  return found;
}

function getAllBookings() {
  return db.read("bookings", DEFAULTS).bookings;
}

function formatServiceList() {
  const services = getAvailableServices();
  let msg = `📅 *Available Services*\n\n`;
  services.forEach((s, i) => {
    msg += `${i + 1}. ${s}\n`;
  });
  msg += `\n_Use: *!book [number] [date] [time]*_\n`;
  msg += `_Example: !book 1 2024-12-25 14:00_`;
  return msg;
}

function formatUserBookings(jid) {
  const bookings = getUserBookings(jid);
  if (!bookings.length) return "📅 You have no bookings. Type *!services* to see options.";
  let msg = `📅 *Your Bookings*\n\n`;
  for (const b of bookings) {
    const icon = b.status === "confirmed" ? "✅" : "❌";
    msg += `${icon} *#${b.id}* — ${b.service}\n`;
    msg += `   📆 ${b.date} at ${b.time}\n`;
    msg += `   Status: ${b.status}\n\n`;
  }
  msg += `_Type *!cancel [id]* to cancel a booking_`;
  return msg;
}

module.exports = {
  book,
  getUserBookings,
  cancelBooking,
  getAllBookings,
  getAvailableServices,
  formatServiceList,
  formatUserBookings,
};
