import jwt from "jsonwebtoken";
import connectDB from "../db.js"; // MongoDB connection

export default async function handler(req, res) {
  const { path } = req.query; // e.g. /api/doctor?path=slots

  try {
    const db = await connectDB();

    // =========================
    //  LOGIN (doctor dashboard)
    // =========================
    if (path === "login" && req.method === "POST") {
      const { email, password } = req.body;

      if (!email || !password)
        return res.status(400).json({ error: "Email and password required" });

      if (
        email === process.env.DOCTOR_EMAIL &&
        password === process.env.DOCTOR_PASSWORD
      ) {
        const token = jwt.sign({ email }, process.env.JWT_SECRET, {
          expiresIn: "12h",
        });
        return res.status(200).json({ success: true, token });
      } else {
        return res.status(401).json({ error: "Invalid credentials" });
      }
    }

    // =========================
    //  GET ALL BOOKINGS
    // =========================
    if (path === "bookings" && req.method === "GET") {
      const authHeader = req.headers.authorization;
      if (!authHeader)
        return res.status(401).json({ error: "Unauthorized" });

      const token = authHeader.split(" ")[1];
      jwt.verify(token, process.env.JWT_SECRET);

      const bookings = await db
        .collection("bookings")
        .find()
        .sort({ date: 1, slot: 1 })
        .toArray();

      return res.status(200).json({ success: true, bookings });
    }

    // =========================
    //  GET 24-HOUR SLOTS
    // =========================
    if (path === "slots" && req.method === "GET") {
      const { date } = req.query;
      if (!date)
        return res.status(400).json({ error: "Date required" });

      const nowUTC = new Date();
      const istNow = new Date(nowUTC.getTime() + 5.5 * 60 * 60 * 1000);

      // Fetch both bookings and successful payments
      const payments = await db
        .collection("payments")
        .find({ date, status: { $in: ["PAID", "SUCCESS"] } })
        .toArray();

      const bookings = await db.collection("bookings").find({ date }).toArray();
      const unavailableDocs = await db.collection("unavailableSlots").find({ date }).toArray();

      // Merge both (for real-time accurate availability)
      const allBooked = [...bookings, ...payments];

      // Normalization helper
      const normalize = (s) => s.trim().replace(/\s+/g, "").toUpperCase();
      const bookedSlots = allBooked.map(b => normalize(b.slot));
      const unavailableSlots = unavailableDocs.map(s => normalize(s.slot));

      const slots = [];

      // Generate exactly 24 hourly slots (12 AM → 11 PM)
      for (let h = 0; h < 24; h++) {
        const hour12 = h % 12 === 0 ? 12 : h % 12;
        const period = h < 12 ? "AM" : "PM";
        const slot = `${hour12.toString().padStart(2, "0")}:00 ${period}`;

        const [yyyy, mm, dd] = date.split("-");
        const slotIST = new Date(`${yyyy}-${mm}-${dd}T${h.toString().padStart(2, "0")}:00:00+05:30`);

        let status = "available";
        if (bookedSlots.includes(normalize(slot))) status = "booked";
        else if (unavailableSlots.includes(normalize(slot))) status = "unavailable";
        else if (slotIST < istNow) status = "past";

        slots.push({ slot, status });
      }

      return res.status(200).json({ success: true, date, slots });
    }

    // =========================
    //  MARK SLOT UNAVAILABLE
    // =========================
    if (path === "set-unavailable" && req.method === "POST") {
      const { date, slot } = req.body;
      if (!date || !slot)
        return res.status(400).json({ error: "Date and slot required" });

      await db.collection("unavailableSlots").insertOne({
        date,
        slot,
        createdAt: new Date(),
      });

      return res
        .status(200)
        .json({ success: true, message: "Slot marked unavailable" });
    }

    // =========================
    //  MAKE SLOT AVAILABLE AGAIN
    // =========================
    if (path === "set-available" && req.method === "POST") {
      const { date, slot } = req.body;
      if (!date || !slot)
        return res.status(400).json({ error: "Date and slot required" });

      await db.collection("unavailableSlots").deleteOne({ date, slot });
      return res
        .status(200)
        .json({ success: true, message: "Slot made available again" });
    }

    // =========================
    //  INVALID PATH
    // =========================
    return res.status(404).json({ error: "Invalid path" });

  } catch (err) {
    console.error("❌ Doctor API error:", err);
    res.status(500).json({ error: "Server error" });
  }
}