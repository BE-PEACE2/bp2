// api/get-slots.js
import connectDB from "../db.js";

export default async function handler(req, res) {
  try {
    const db = await connectDB();
    const bookings = db.collection("bookings");

    const { date } = req.query; // e.g., 2025-09-28
    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    const today = new Date().toISOString().split("T")[0];
    const now = new Date();

    // fetch booked slots for that date
    const confirmed = await bookings.find({
      status: { $in: ["PAID", "SUCCESS"] },
      date,
    }).toArray();

    const bookedSlots = confirmed.map((b) => b.slot);

    // generate all 1-hour slots (24h)
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

      // 🔴 Booked
      if (bookedSlots.includes(slot)) {
        status = "BOOKED";
      } else {
        // convert date string into real Date object (midnight)
        const selectedDate = new Date(date);
        const todayDate = new Date(today);

        // ⏳ Check past day
        if (selectedDate < todayDate) {
          status = "PAST";
        }

        // ⏳ Check today’s past time
        else if (date === today) {
          const [time, meridian] = slot.split(" ");
          let [hour, minute] = time.split(":").map(Number);
          if (meridian === "PM" && hour !== 12) hour += 12;
          if (meridian === "AM" && hour === 12) hour = 0;

          const slotDateTime = new Date(
            `${date}T${hour.toString().padStart(2, "0")}:${minute}:00`
          );

          if (slotDateTime < now) {
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