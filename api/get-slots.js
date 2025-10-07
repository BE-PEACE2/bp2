// api/get-slots.js
import connectDB from "../db.js";

export default async function handler(req, res) {
  try {
    const db = await connectDB();
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Missing date parameter" });
    }

    // 🧩 Step 1: fetch all bookings for that date
    const bookings = await db.collection("bookings").find({ date }).toArray();

    // Normalize statuses to uppercase
    const bookedSlots = bookings
      .filter(
        (b) =>
          ["SUCCESS", "PAID", "BOOKED"].includes((b.status || "").toUpperCase())
      )
      .map((b) => b.slot);

    // 🧩 Step 2: generate all 24 hourly slots
    const aSlots = [];
    for (let h = 0; h < 24; h++) {
      const suffix = h < 12 ? "am" : "pm";
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      const t = `${hour12.toString().padStart(2, "0")}:00 ${suffix}`;
      aSlots.push(t);
    }

    // 🧩 Step 3: mark slot status
    const today = new Date();
    const selected = new Date(date);
    const todayIST = new Date(today.getTime() + 5.5 * 60 * 60 * 1000);
    const selectedDateIST = new Date(selected.getTime() + 5.5 * 60 * 60 * 1000);

    const slots = aSlots.map((slot) => {
      let status = "AVAILABLE";

      // If slot was booked in DB → mark as BOOKED
      if (bookedSlots.includes(slot)) status = "BOOKED";

      // Mark past slots (only if same date)
      const [time, suffix] = slot.split(" ");
      let [hour] = time.split(":").map(Number);
      if (suffix === "pm" && hour !== 12) hour += 12;
      if (suffix === "am" && hour === 12) hour = 0;

      const slotTime = new Date(selectedDateIST);
      slotTime.setHours(hour, 0, 0, 0);

      if (
        selectedDateIST.toDateString() === todayIST.toDateString() &&
        slotTime.getTime() < todayIST.getTime()
      ) {
        status = "PAST";
      }

      return { time: slot, status };
    });

    // 🧩 Step 4: send result
    return res.status(200).json({ date, slots });
  } catch (err) {
    console.error("❌ get-slots error:", err);
    res.status(500).json({ error: err.message });
  }
}