const connectDB = require("../db");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const db = await connectDB();
    const bookings = db.collection("bookings");

    const newBooking = req.body; // data coming from frontend form
    const result = await bookings.insertOne(newBooking);

    res.status(200).json({ success: true, id: result.insertedId });
  } catch (err) {
    console.error("Booking save error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
};