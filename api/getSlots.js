const connectDB = require("../db");

module.exports = async (req, res) => {
  try {
    const db = await connectDB();
    const bookings = db.collection("bookings");

    const { date } = req.query; // e.g., 2025-09-28
    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    // fetch confirmed bookings for that date
    const confirmed = await bookings.find({ status: "confirmed", date }).toArray();

    // generate all 30-minute slots for 24h
    const allSlots = [];
    for (let h = 0; h < 24; h++) {
      for (let m of [0, 30]) {
        const hour = h % 12 === 0 ? 12 : h % 12;
        const suffix = h < 12 ? "AM" : "PM";
        const minute = m === 0 ? "00" : "30";
        allSlots.push(`${hour.toString().padStart(2, "0")}:${minute} ${suffix}`);
      }
    }

    // remove booked slots
    const bookedSlots = confirmed.map(b => b.slot);
    const available = allSlots.filter(slot => !bookedSlots.includes(slot));

    res.status(200).json({ date, available });
  } catch (err) {
    console.error("Get slots error:", err);
    res.status(500).json({ error: "Failed to fetch slots" });
  }
};