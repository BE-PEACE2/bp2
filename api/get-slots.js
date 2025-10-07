// api/get-slots.js
import connectDB from "../db.js";

export default async function handler(req, res) {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Missing date parameter" });

    // ✅ Connect MongoDB
    const db = await connectDB();

    // ✅ Fetch all bookings for that date
    const bookings = await db.collection("bookings").find({ date }).toArray();

    // Normalize booked slots (case-insensitive, consistent format)
    const bookedSlots = bookings
      .filter(b => {
        const status = (b.status || "").toString().trim().toUpperCase();
        return ["SUCCESS", "PAID", "BOOKED", "CONFIRMED"].includes(status);
      })
      .map(b => (b.slot || "").trim().toUpperCase());

    console.log("📅 Requested Date:", date);
    console.log("🎯 Booked Slots Found:", bookedSlots);

    // ✅ IST Timezone setup
    const nowUTC = new Date();
    const nowIST = new Date(nowUTC.getTime() + 5.5 * 60 * 60 * 1000);
    const todayIST = nowIST.toISOString().split("T")[0];

    // ✅ Generate 24 slots
    const allSlots = Array.from({ length: 24 }, (_, h) => {
      const suffix = h < 12 ? "AM" : "PM";
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      return `${hour12.toString().padStart(2, "0")}:00 ${suffix}`;
    });

    // ✅ Build slot list
    const slots = allSlots.map(slot => {
      let status = "AVAILABLE";

      const normalizedSlot = slot.trim().toUpperCase();

      // Mark as booked if any match found
      if (bookedSlots.includes(normalizedSlot)) {
        status = "BOOKED";
      }

      // Mark as past only for current date
      const [time, meridiem] = slot.split(" ");
      let [hour, minute] = time.split(":").map(Number);
      if (meridiem === "PM" && hour !== 12) hour += 12;
      if (meridiem === "AM" && hour === 12) hour = 0;

      const slotDateIST = new Date(`${date}T${hour.toString().padStart(2, "0")}:${minute}:00+05:30`);
      if (date === todayIST && slotDateIST < nowIST) status = "PAST";

      return { time: slot, status };
    });

    return res.status(200).json({ date, slots });

  } catch (err) {
    console.error("❌ get-slots error:", err);
    return res.status(500).json({ error: err.message });
  }
}