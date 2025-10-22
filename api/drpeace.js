// /api/drpeace.js
import connectDB from "../db.js";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST allowed" });
    }

    const { message, user } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // 🔐 Optional token validation
    let isDoctor = false;
    let userEmail = null;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userEmail = decoded.email;
        if (decoded.role === "doctor") isDoctor = true;
      }
    } catch {
      // Ignore if no token
    }

    const db = await connectDB();
    const chats = db.collection("drpeace_chats");

    // 💾 Save user question
    await chats.insertOne({
      type: "question",
      message,
      user,
      timestamp: new Date(),
    });

    // 🧠 Simple AI-style replies
    const name = user?.name || "there";
    const role = user?.role || "visitor";
    let reply = "";

    if (/book/i.test(message)) {
      reply = `You can book your consultation here 👉 <a href="/booking.html" style="color:#c71585;">Book Now</a>`;
    } else if (/hi|hello|hey/i.test(message)) {
      reply = `👋 Hello ${name}! I’m Dr Peace, your AI health assistant. How can I help you today?`;
    } else if (/payment|paid|fee/i.test(message)) {
      reply = `💳 All consultation fees are securely processed via Cashfree. Once payment is successful, your appointment automatically appears as “Booked.”`;
    } else if (/waiting|queue/i.test(message)) {
      reply = `⏳ After payment, your name will appear in the waiting list. You can join your consultation once the doctor starts your session.`;
    } else if (/dashboard|patient/i.test(message)) {
      reply = `🩺 You can access your patient dashboard here: <a href="/dashboard.html" style="color:#c71585;">Dashboard</a>`;
    } else if (role === "doctor") {
      reply = `👨‍⚕️ Welcome back, Doctor! You can view the current waiting queue from <a href="/doctor-dashboard.html" style="color:#c71585;">Doctor Dashboard</a>.`;
    } else {
      reply = `I’m here to help you with bookings, payments, and health questions. You can say “Book Appointment” to get started.`;
    }

    // 💾 Save bot reply
    await chats.insertOne({
      type: "reply",
      message: reply,
      user,
      timestamp: new Date(),
    });

    return res.status(200).json({
      success: true,
      reply,
      actions: { bookUrl: "/booking.html" },
    });
  } catch (err) {
    console.error("❌ DrPeace API error:", err);
    res.status(500).json({ error: "Server error" });
  }
}