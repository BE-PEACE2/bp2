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
    //  GET BOOKINGS BY DATE
    // =========================
    if (path === "bookings" && req.method === "GET") {
      const authHeader = req.headers.authorization;
      if (!authHeader)
        return res.status(401).json({ error: "Unauthorized" });

      const token = authHeader.split(" ")[1];
      jwt.verify(token, process.env.JWT_SECRET);

      const { date } = req.query;
      if (!date)
        return res.status(400).json({ error: "Date required" });

      const bookings = await db
        .collection("bookings")
        .find({ date })
        .sort({ slot: 1 })
        .toArray();

      const payments = await db
        .collection("payments")
        .find({ date, status: { $in: ["PAID", "SUCCESS"] } })
        .toArray();

      // merge confirmed payments + direct bookings
      const merged = [
        ...bookings.map(b => ({ ...b, source: "booking" })),
        ...payments.map(p => ({ ...p, source: "payment" }))
      ];

      return res.status(200).json({ success: true, bookings: merged });
    }

    // =========================
//  GET 24-HOUR SLOTS (TIMEZONE SAFE)
// =========================
if (path === "slots" && req.method === "GET") {
  const { date, tz = "Asia/Kolkata" } = req.query; // allow timezone param (default IST)
  if (!date)
    return res.status(400).json({ error: "Date required" });

  // current time in user's timezone
  const nowLocal = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
    console.log("🕒 [SLOTS]", { date, tz, nowLocal: nowLocal.toString() });

  // pull all confirmed bookings + unavailable slots
  const payments = await db
    .collection("payments")
    .find({ date, status: { $in: ["PAID", "SUCCESS"] } })
    .toArray();
  const bookings = await db.collection("bookings").find({ date }).toArray();
  const unavailableDocs = await db.collection("unavailableSlots").find({ date }).toArray();

  const allBooked = [...bookings, ...payments];
  const normalize = (s) => s.trim().replace(/\s+/g, "").toUpperCase();
  const bookedSlots = allBooked.map(b => normalize(b.slot));
  const unavailableSlots = unavailableDocs.map(s => normalize(s.slot));

  const slots = [];

  for (let h = 0; h < 24; h++) {
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const period = h < 12 ? "AM" : "PM";
    const slot = `${hour12.toString().padStart(2, "0")}:00 ${period}`;

    const [yyyy, mm, dd] = date.split("-");
    // construct slot time in the same timezone as user
    const slotLocal = new Date(
      new Date(`${yyyy}-${mm}-${dd}T${h.toString().padStart(2, "0")}:00:00`).toLocaleString(
        "en-US",
        { timeZone: tz }
      )
    );

    let status = "available";
    if (bookedSlots.includes(normalize(slot))) status = "booked";
    else if (unavailableSlots.includes(normalize(slot))) status = "unavailable";
    else if (slotLocal < nowLocal) status = "past";

    slots.push({ slot, status });
  }

  return res.status(200).json({ success: true, date, tz, slots });
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
//  TEST TIMEZONE ENDPOINT
// =========================
if (path === "test-timezone" && req.method === "GET") {
  const { tz = "Asia/Kolkata" } = req.query;
  
  const nowUTC = new Date();
  const nowLocal = new Date(nowUTC.toLocaleString("en-US", { timeZone: tz }));

  // Calculate difference from UTC (hours and minutes)
  const offsetMin = nowLocal.getTimezoneOffset();
  const diffHours = Math.floor(Math.abs(offsetMin) / 60);
  const diffMinutes = Math.abs(offsetMin) % 60;
  const sign = offsetMin <= 0 ? "+" : "-";
  const offsetString = `${sign}${diffHours}h ${diffMinutes}m`;

  return res.status(200).json({
    success: true,
    timezone: tz,
    utc_time: nowUTC.toISOString(),
    local_time: nowLocal.toString(),
    offset_from_utc: offsetString,
    message: `Current local time in ${tz}`
  });
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