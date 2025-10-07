// api/get-slots.js
import connectDB from "../db.js";

export default async function handler(req, res) {
  try {
    // 1️⃣ Get date from query
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Missing date parameter" });

    // 2️⃣ Connect MongoDB
    const db = await connectDB();

    // 3️⃣ Fetch booked slots (case-insensitive)
    const bookings = await db.collection("bookings")
      .find({
        date,
        $expr: {
          $in: [
            { $toUpper: "$status" },
            ["SUCCESS", "PAID", "CONFIRMED", "BOOKED"]
          ]
        }
      })
      .toArray();

    const bookedSlots = bookings.map(b => b.slot);
    console.log("📅 Date requested:", date);
    console.log("🎯 Booked slots:", bookedSlots);

    // 4️⃣ Get today’s date in IST
    const nowUTC = new Date();
    const nowIST = new Date(nowUTC.getTime() + 5.5 * 60 * 60 * 1000);
    const todayIST = nowIST.toISOString().split("T")[0];

    // 5️⃣ Create 24 hourly slots
    const allSlots = Array.from({ length: 24 }, (_, h) => {
      const suffix = h < 12 ? "AM" : "PM";
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      return `${hour12.toString().padStart(2, "0")}:00 ${suffix}`;
    });

    // 6️⃣ Build slot objects
    const slots = allSlots.map(slot => {
      let status = "AVAILABLE";

      // Mark booked slots
      if (bookedSlots.includes(slot)) status = "BOOKED";

      // Create slot time in IST
      const [time, meridiem] = slot.split(" ");
      let [hour, minute] = time.split(":").map(Number);
      if (meridiem === "PM" && hour !== 12) hour += 12;
      if (meridiem === "AM" && hour === 12) hour = 0;

      const slotDateIST = new Date(`${date}T${hour.toString().padStart(2, "0")}:${minute}:00+05:30`);

      // Mark "past" slots only for today
      if (date === todayIST && slotDateIST < nowIST) {
        status = "PAST";
      }

      return { time: slot, status };
    });

    return res.status(200).json({ date, slots });

  } catch (err) {
    console.error("❌ get-slots error:", err);
    return res.status(500).json({ error: err.message });
  }
}