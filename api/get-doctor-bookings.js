// api/get-doctor-bookings.js
import connectDB from "../db.js";

export default async function handler(req, res) {
  try {
    const db = await connectDB();
    const bookings = db.collection("bookings");

    // Get today's and tomorrow's confirmed bookings
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const confirmed = await bookings
      .find({
        status: { $in: ["PAID", "SUCCESS"] }, // ✅ allow both
        date: {
          $gte: today.toISOString().split("T")[0],
          $lte: tomorrow.toISOString().split("T")[0],
        },
      })
      .sort({ date: 1, slot: 1 })
      .toArray();

    // 🔗 Add meeting links for doctor
    const withLinks = confirmed.map((b) => {
      const meetingLink = `https://bepeace.in/consult.html?room=${b.order_id}&date=${b.date}&slot=${encodeURIComponent(
        b.slot
      )}&name=${encodeURIComponent(b.customer_name || "Patient")}`;

      return {
        order_id: b.order_id,
        name: b.customer_name,
        email: b.customer_email,
        phone: b.customer_phone,
        date: b.date,
        slot: b.slot,
        amount: b.amount,
        currency: b.currency,
        status: b.status,
        meetingLink, // ✅ doctor can just click to join
      };
    });

    res.status(200).json({ bookings: withLinks });
  } catch (err) {
    console.error("❌ Doctor bookings fetch error:", err);
    res.status(500).json({ error: "Database error" });
  }
}