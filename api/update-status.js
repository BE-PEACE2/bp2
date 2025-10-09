import connectDB from "../db.js";
import Booking from "../models/booking.js";

export default async function handler(req, res) {
  const { bookingId, status } = req.body;
  await connectDB();
  await Booking.findByIdAndUpdate(bookingId, { status });
  res.json({ success: true });
}