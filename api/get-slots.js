// api/get-slots.js
import connectDB from "../db.js";

export default async function handler(req, res) {
  try {
    const db = await connectDB();
    const bookings = db.collection("bookings");

    const { date } = req.query; // YYYY-MM-DD
    if (!date) return res.status(400).json({ error: "Date is required" });

    // ✅ Always use IST internally for consistency
    const nowUTC = new Date();
    const nowIST = new Date(nowUTC.getTime() + 5.5 * 60 * 60 * 1000);
    const todayStrIST = nowIST.toISOString().split("T")[0];

    // ✅ Fetch already booked slots
    const confirmed = await bookings.find({
      status: { $in: ["PAID", "SUCCESS"] },
      date,
    }).toArray();

    const bookedSlots = confirmed.map(b => b.slot);

    // ✅ Generate 24 hourly slots
    const allSlots = [];
    for (let h = 0; h < 24; h++) {
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      const suffix = h < 12 ? "AM" : "PM";
      const time = `${hour12.toString().padStart(2, "0")}:00 ${suffix}`;
      allSlots.push(time);
    }

    const [yyyy, mm, dd] = date.split("-").map(Number);
    const selectedDate = new Date(yyyy, mm - 1, dd);
    const todayDateIST = new Date(todayStrIST);

    // ✅ Map each slot
    const slots = allSlots.map(slot => {
      let status = "AVAILABLE";

      // Split slot into hours/minutes
      const [timeStr, meridian] = slot.split(" ");
      let [hour, minute] = timeStr.split(":").map(Number);
      if (meridian === "PM" && hour !== 12) hour += 12;
      if (meridian === "AM" && hour === 12) hour = 0;

      const slotIST = new Date(yyyy, mm - 1, dd, hour, minute);
      const slotUTC = new Date(slotIST.getTime() - 5.5 * 60 * 60 * 1000); // convert IST → UTC

      // ✅ Mark BOOKED
      if (bookedSlots.includes(slot)) {
        status = "BOOKED";
      }
      // ✅ Mark PAST
      else if (
        selectedDate.getTime() === todayDateIST.getTime() &&
        slotIST.getTime() <= nowIST.getTime()
      ) {
        status = "PAST";
      }

      return {
        time: slot, // e.g., "09:00 AM" (IST)
        status,
        ist_time: slotIST.toISOString(),
        utc_time: slotUTC.toISOString(),
      };
    });

    res.status(200).json({ date, timezone: "Asia/Kolkata", slots });
  } catch (err) {
    console.error("Get slots error:", err);
    res.status(500).json({ error: "Failed to fetch slots" });
  }
}