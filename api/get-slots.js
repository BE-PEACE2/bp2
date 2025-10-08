import connectDB from "../db.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Missing or invalid date parameter" });
    }

    const db = await connectDB();
    const bookings = db.collection("bookings");

    const bookedRecords = await bookings
      .find({ date, status: { $in: ["SUCCESS", "PAID", "BOOKED", "CONFIRMED"] } })
      .toArray();

    const bookedSlots = bookedRecords
      .map(b => (b.slot || "").trim().toUpperCase())
      .filter(Boolean);

    console.log("📅 Requested Date:", date);
    console.log("🔴 Booked Slots:", bookedSlots);

    // ✅ Get IST time reliably
    const nowUTC = new Date();
    const nowIST = new Date(nowUTC.getTime() + (5.5 * 60 * 60 * 1000)); // Convert UTC → IST
    const todayIST = nowIST.toISOString().split("T")[0];
    const currentISTHour = nowIST.getHours(); // integer 0-23

    // ✅ Create 24-hour slots
    const allSlots = Array.from({ length: 24 }, (_, h) => {
      const suffix = h < 12 ? "AM" : "PM";
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      return `${hour12.toString().padStart(2, "0")}:00 ${suffix}`;
    });

    const slots = allSlots.map(slot => {
      const normalizedSlot = slot.trim().toUpperCase();
      const [time, meridiem] = slot.split(" ");
      let [hour, minute] = time.split(":").map(Number);
      if (meridiem === "PM" && hour !== 12) hour += 12;
      if (meridiem === "AM" && hour === 12) hour = 0;

      let status = "AVAILABLE";

      // 🔴 Booked slots first
      if (bookedSlots.includes(normalizedSlot)) {
        status = "BOOKED";
      }

      // ⚫ Mark as PAST only for *today* and if slot hour < current IST hour
      if (date === todayIST && hour < currentISTHour && !bookedSlots.includes(normalizedSlot)) {
        status = "PAST";
      }

      // 🟩 Future dates → always AVAILABLE unless booked
      if (date > todayIST && !bookedSlots.includes(normalizedSlot)) {
        status = "AVAILABLE";
      }

      return { time: slot, status };
    });

    return res.status(200).json({ date, slots });
  } catch (err) {
    console.error("❌ get-slots error:", err);
    return res.status(500).json({ error: err.message });
  }
}