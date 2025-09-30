// api/get-slots.js
import connectDB from "../db.js";

export default async function handler(req, res) {
  try {
    const db = await connectDB();
    const bookings = db.collection("bookings");

    const { date } = req.query; // YYYY-MM-DD format
    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

    // fetch booked slots for that date
    const confirmed = await bookings.find({
      status: { $in: ["PAID", "SUCCESS"] },
      date,
    }).toArray();

    const bookedSlots = confirmed.map((b) => b.slot);

    // generate all 1-hour slots
    const allSlots = [];
    for (let h = 0; h < 24; h++) {
      const hour = h % 12 === 0 ? 12 : h % 12;
      const suffix = h < 12 ? "AM" : "PM";
      const time = `${hour.toString().padStart(2, "0")}:00 ${suffix}`;
      allSlots.push(time);
    }

    // classify each slot
    const slots = allSlots.map((slot) => {
      let status = "AVAILABLE";

      // 🔴 Booked slots
      if (bookedSlots.includes(slot)) {
        status = "BOOKED";
      } else {
        const selectedDate = new Date(date);
        const todayDate = new Date(todayStr);

        // ⏳ Entire day is in the past
        if (selectedDate < todayDate) {
          status = "PAST";
        }

        // ⏳ If today, check time
        else if (date === todayStr) {
          const [timeStr, meridian] = slot.split(" ");
          let [hour, minute] = timeStr.split(":").map(Number);

          if (meridian === "PM" && hour !== 12) hour += 12;
          if (meridian === "AM" && hour === 12) hour = 0;

          const slotDateTime = new Date(`${date}T${hour.toString().padStart(2, "0")}:${minute}:00`);

          if (slotDateTime < today) {
            status = "PAST";
          }
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