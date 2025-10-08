// /api/get-slots.js
import connectDB from "../db.js";

export default async function handler(req, res) {
  try {
    // ✅ Allow only GET
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // ✅ Validate date parameter
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Missing or invalid date parameter" });
    }

    // ✅ Connect to MongoDB
    const db = await connectDB();
    const bookings = db.collection("bookings");

    // ✅ Fetch booked slots
    const bookedRecords = await bookings
      .find({ date, status: { $in: ["SUCCESS", "PAID", "BOOKED", "CONFIRMED"] } })
      .toArray();

    const bookedSlots = bookedRecords
      .map(b => (b.slot || "").trim().toUpperCase())
      .filter(Boolean);

    console.log("📅 Requested Date:", date);
    console.log("🔴 Booked Slots:", bookedSlots);

    // ✅ Get current IST time correctly (without shifting date)
   const nowUTC = new Date();
     const nowIST = new Date(nowUTC.getTime() + (5.5 * 60 * 60 * 1000));
     const todayIST = nowIST.toISOString().split("T")[0];

    // ✅ Generate all 24 hourly slots
    const allSlots = Array.from({ length: 24 }, (_, h) => {
      const suffix = h < 12 ? "AM" : "PM";
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      return `${hour12.toString().padStart(2, "0")}:00 ${suffix}`;
    });

    // ✅ Build slot list with correct statuses
    const slots = allSlots.map(slot => {
      const normalizedSlot = slot.trim().toUpperCase();
      const [time, meridiem] = slot.split(" ");
      let [hour, minute] = time.split(":").map(Number);
      if (meridiem === "PM" && hour !== 12) hour += 12;
      if (meridiem === "AM" && hour === 12) hour = 0;

      // Create IST-based slot time
      const slotDateIST = new Date(`${date}T${hour.toString().padStart(2, "0")}:${minute}:00+05:30`);

      let status = "AVAILABLE";

      // If booked, mark RED
      if (bookedSlots.includes(normalizedSlot)) {
        status = "BOOKED";
      }

      // ✅ If slot is for today and time already passed → mark as PAST
if (date === todayIST) {
  if (slotDateIST.getTime() < nowIST.getTime()) {
    if (bookedSlots.includes(normalizedSlot)) {
      status = "BOOKED"; // Booked stays red
    } else {
      status = "PAST"; // Past unbooked → gray
    }
  }
}

      return { time: slot, status };
    });

    // ✅ Sort in chronological order
    slots.sort((a, b) => {
      const parse = t => {
        const [time, mer] = t.split(" ");
        let [h, m] = time.split(":").map(Number);
        if (mer === "PM" && h !== 12) h += 12;
        if (mer === "AM" && h === 12) h = 0;
        return h * 60 + m;
      };
      return parse(a.time) - parse(b.time);
    });

    // ✅ Respond
    return res.status(200).json({ date, slots });

  } catch (err) {
    console.error("❌ get-slots error:", err);
    return res.status(500).json({ error: err.message });
  }
}