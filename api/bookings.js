// /api/bookings.js
import connectDB from "../db.js";
import { db as firebaseDB } from "../utils/firebase-admin.js";

export default async function handler(req, res) {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ success: false, error: "Email is required" });
  }

  try {
    // Step 1️⃣ — Get bookings from MongoDB
    const db = await connectDB();
    const bookings = db.collection("bookings");
    const mongoBookings = await bookings.find({ email }).sort({ date: -1 }).toArray();

    // Step 2️⃣ — Get bookings from Firebase (Realtime DB)
    let firebaseBookings = [];
    try {
      const snapshot = await firebaseDB.ref("bookings").once("value");
      const allData = snapshot.val() || {};
      firebaseBookings = Object.values(allData).filter(b => b.email === email);
    } catch (firebaseErr) {
      console.warn("⚠️ Firebase read error:", firebaseErr.message);
    }

    // Step 3️⃣ — Merge & remove duplicates (by orderId)
const allBookings = [...mongoBookings, ...firebaseBookings.map(b => ({
  ...b,
  orderId: b.orderId || b.order_id, // normalize field name
}))];

const seen = new Set();
const unique = allBookings.filter(b => {
  if (!b.orderId) return false;
  if (seen.has(b.orderId)) return false;
  seen.add(b.orderId);
  return true;
});

    // Step 4️⃣ — Add computed fields for dashboard
    const enriched = unique.map(b => {
      const status = (b.status || "CONFIRMED").toUpperCase();
      const isUpcoming = ["PAID", "SUCCESS", "CONFIRMED"].includes(status);
      const joinLink = isUpcoming
        ? `https://meet.bepeace.in/bepeace-${b.orderId}`
        : null;

      const receiptUrl = `https://bepeace.in/payment-success.html?order_id=${b.orderId}`;
      const statusColor =
        status === "PAID" || status === "SUCCESS" || status === "CONFIRMED"
          ? "upcoming"
          : status === "COMPLETED"
          ? "completed"
          : status === "CANCELLED"
          ? "cancelled"
          : "upcoming";

      return {
        orderId: b.orderId,
        name: b.name || "Patient",
        email: b.email,
        phone: b.phone || "",
        date: b.date || "",
        slot: b.slot || "",
        concern: b.concern || "",
        amount: b.amount || 0,
        status,
        receiptUrl,
        joinLink,
        statusColor,
        createdAt: b.createdAt || new Date().toISOString(),
      };
    });

    // Step 5️⃣ — Sort newest first
    enriched.sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.status(200).json({
      success: true,
      count: enriched.length,
      bookings: enriched,
    });
  } catch (err) {
    console.error("💥 /api/bookings error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}