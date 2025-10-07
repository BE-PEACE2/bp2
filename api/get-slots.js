// api/get-slots.js
import connectDB from "../db.js";

export default async function handler(req, res) {
  try {
    // 1️⃣ Get date from query
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: "Missing date parameter" });
    }

    // 2️⃣ Connect MongoDB
    const db = await connectDB();

    // 3️⃣ Fetch booked slots from DB
    const bookings = await db.collection("bookings")
      .find({
        date: date, // exact format: YYYY-MM-DD
        status: { $in: ["SUCCESS", "PAID"] } // only confirmed bookings
      })
      .toArray();

    const bookedSlots = bookings.map(b => b.slot);
    console.log("📅 Date requested:", date);
    console.log("🎯 Booked slots:", bookedSlots);

    // 4️⃣ Time setup for IST (India time)
    const now = new Date();
    const nowIST = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const selectedDateIST = new Date(`${date}T00:00:00+05:30`);

    // 5️⃣ Create 24 hourly slots (12-hour format)
    const allSlots = Array.from({ length: 24 }, (_, h) => {
      const suffix = h < 12 ? "am" : "pm";
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      return `${hour12.toString().padStart(2, "0")}:00 ${suffix}`;
    });

    // 6️⃣ Build final slots with statuses
    const slots = allSlots.map(slot => {
      let status = "AVAILABLE";

      // Mark booked slots (from DB)
      if (bookedSlots.includes(slot)) {
        status = "BOOKED";
      }

      // Convert slot to Date for past check
      const [time, meridiem] = slot.split(" ");
      let [hour, minute] = time.split(":").map(Number);
      if (meridiem === "pm" && hour !== 12) hour += 12;
      if (meridiem === "am" && hour === 12) hour = 0;

      const slotTime = new Date(selectedDateIST);
      slotTime.setHours(hour, minute, 0, 0);

      // Mark past slots (only for current day)
      if (
        selectedDateIST.toDateString() === nowIST.toDateString() &&
        slotTime < nowIST
      ) {
        status = "PAST";
      }

      return { time: slot, status };
    });

    // 7️⃣ Send result
    return res.status(200).json({ date, slots });

  } catch (err) {
    console.error("❌ get-slots error:", err);
    return res.status(500).json({ error: err.message });
  }
}