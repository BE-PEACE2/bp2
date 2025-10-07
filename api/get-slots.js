// /api/get-slots.js
import connectDB from "../db.js";

export default async function handler(req, res) {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Missing date parameter" });

    // ✅ Connect MongoDB
    const db = await connectDB();

    // ✅ Fetch bookings for this date (only confirmed statuses)
    const bookings = await db.collection("bookings")
      .find({ date, status: { $in: ["SUCCESS", "PAID", "BOOKED", "CONFIRMED"] } })
      .toArray();

    const bookedSlots = bookings
      .map(b => (b.slot || "").trim().toUpperCase())
      .filter(Boolean);

    console.log("📅 Requested Date:", date);
    console.log("🔴 Booked Slots:", bookedSlots);

    // ✅ IST Timezone setup
    const now = new Date();
    const nowIST = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const todayIST = nowIST.toISOString().split("T")[0];

    // ✅ Generate 24 hourly slots (12-hour format)
    const allSlots = Array.from({ length: 24 }, (_, h) => {
      const suffix = h < 12 ? "AM" : "PM";
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      return `${hour12.toString().padStart(2, "0")}:00 ${suffix}`;
    });

    // ✅ Build final slot list
    const slots = allSlots.map(slot => {
      let status = "AVAILABLE";
      const normalizedSlot = slot.trim().toUpperCase();

      // Check if booked
      if (bookedSlots.includes(normalizedSlot)) status = "BOOKED";

      // Calculate slot datetime (IST)
      const [time, meridiem] = slot.split(" ");
      let [hour, minute] = time.split(":").map(Number);
      if (meridiem === "PM" && hour !== 12) hour += 12;
      if (meridiem === "AM" && hour === 12) hour = 0;

      const slotDateIST = new Date(`${date}T${hour.toString().padStart(2, "0")}:${minute}:00+05:30`);

      // Mark past only for the current date
      if (date === todayIST && slotDateIST < nowIST) status = "PAST";

      return { time: slot, status };
    });

    // ✅ Send back results
    return res.status(200).json({ date, slots });

  } catch (err) {
    console.error("❌ get-slots error:", err);
    return res.status(500).json({ error: err.message });
  }
}