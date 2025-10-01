// api/get-slots.js
import connectDB from "../db.js";

export default async function handler(req, res) {
  try {
    const db = await connectDB();
    const bookings = db.collection("bookings");

    const { date } = req.query; // YYYY-MM-DD
    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    // Current date + time
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

    // Get confirmed bookings for this date
    const confirmed = await bookings.find({
      status: { $in: ["PAID", "SUCCESS"] },
      date,
    }).toArray();

    const bookedSlots = confirmed.map((b) => b.slot);

    // Generate all hourly slots
    const allSlots = [];
    for (let h = 0; h < 24; h++) {
      const hour = h % 12 === 0 ? 12 : h % 12;
      const suffix = h < 12 ? "AM" : "PM";
      const time = `${hour.toString().padStart(2, "0")}:00 ${suffix}`;
      allSlots.push(time);
    }

    // Classify slots
    const slots = allSlots.map((slot) => {
      let status = "AVAILABLE";

      if (bookedSlots.includes(slot)) {
        status = "BOOKED";
      } else {
        // Parse slot string → datetime
        const [timeStr, meridian] = slot.split(" ");
        let [hour, minute] = timeStr.split(":").map(Number);
        if (meridian === "PM" && hour !== 12) hour += 12;
        if (meridian === "AM" && hour === 12) hour = 0;

        const [yyyy, mm, dd] = date.split("-").map(Number);
        const slotDateTime = new Date(yyyy, mm - 1, dd, hour, minute, 0);

        const selectedDate = new Date(date);
        const todayDate = new Date(todayStr);

        if (selectedDate < todayDate) {
          status = "PAST"; // whole day before today
        } else if (
          selectedDate.getTime() === todayDate.getTime() &&
          slotDateTime < now
        ) {
          status = "PAST"; // past time today
        }
      }

      return { time: slot, status };
    });

    res.status(200).json({ date, slots });
  } catch (err) {
    console.error("Get slots error:", err);
    res.status(500).json({ error: "Failed to fetch slots" });
  }
}