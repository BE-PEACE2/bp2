// api/saveBooking.js
import connectDB from "../db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const db = await connectDB();
    const bookings = db.collection("bookings");
    const newBooking = req.body;

    if (!newBooking.date || !newBooking.slot) {
      return res.status(400).json({ success: false, error: "Missing date or slot" });
    }

    // ✅ Normalize slot format (example: "3:00 pm" → "03:00 PM")
    const normalizedSlot = normalizeSlot(newBooking.slot);

    // ✅ Check if already booked for same date and slot
    const existing = await bookings.findOne({
      date: newBooking.date,
      slot: { $regex: new RegExp(`^${normalizedSlot}$`, "i") },
      status: { $in: ["SUCCESS", "PAID", "BOOKED", "CONFIRMED"] }
    });

    if (existing) {
      return res.status(409).json({ success: false, error: "This slot is already booked" });
    }

    // ✅ Save new booking
    const result = await bookings.insertOne({
      ...newBooking,
      slot: normalizedSlot,
      createdAt: new Date(),
    });

    res.status(200).json({ success: true, id: result.insertedId });
  } catch (err) {
    console.error("❌ Booking save error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
}

// ✅ Helper function
function normalizeSlot(slot) {
  if (!slot) return "";
  let s = slot.toString().trim().toUpperCase();
  s = s.replace(/^(\d):/, "0$1:");
  return s;
}