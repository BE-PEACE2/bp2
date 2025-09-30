// api/get-doctor-bookings.js
import connectDB from "../db.js";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  try {
    // ✅ Auth check
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }

    // ✅ Parse filters
    const { status = "ALL", range = "ALL", search = "" } = req.query;

    const db = await connectDB();
    const bookings = db.collection("bookings");

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const monthStr = today.toISOString().slice(0, 7); // YYYY-MM

    let startDate = todayStr;
    let endDate = null;
    let isPast = false;

    if (range === "TODAY") {
      endDate = startDate;
    } else if (range === "7DAYS") {
      const d = new Date(today);
      d.setDate(today.getDate() + 7);
      endDate = d.toISOString().split("T")[0];
    } else if (range === "30DAYS") {
      const d = new Date(today);
      d.setDate(today.getDate() + 30);
      endDate = d.toISOString().split("T")[0];
    } else if (range === "PAST") {
      isPast = true;
    }

    // ✅ Build query
    const query = {};
    if (status !== "ALL") {
      query.status = status;
    }

    if (isPast) {
      query.date = { $lt: todayStr }; // all past bookings
    } else if (endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else {
      query.date = { $gte: startDate }; // ALL future
    }

    if (search) {
      query.$or = [
        { customer_name: { $regex: search, $options: "i" } },
        { customer_email: { $regex: search, $options: "i" } },
      ];
    }

    // ✅ Fetch results
    const results = await bookings
      .find(query)
      .sort({ date: isPast ? -1 : 1, slot: 1 }) // past → newest first
      .toArray();

    // 🔗 Add meeting links only if PAID or SUCCESS and in future
    const withLinks = results.map((b) => {
      let meetingLink = null;
      if (!isPast && ["PAID", "SUCCESS"].includes(b.status)) {
        meetingLink = `https://bepeace.in/consult.html?room=${b.order_id}&date=${b.date}&slot=${encodeURIComponent(
          b.slot
        )}&name=${encodeURIComponent(b.customer_name || "Patient")}`;
      }

      return {
        order_id: b.order_id,
        name: b.customer_name,
        email: b.customer_email,
        phone: b.customer_phone,
        date: b.date,
        slot: b.slot,
        amount: b.amount,
        currency: b.currency,
        status: b.status,
        meetingLink,
      };
    });

    // ✅ Summary analytics (only for non-past)
    let todayBookings = 0,
      upcoming = 0,
      todayRevenue = 0,
      monthRevenue = 0;

    if (!isPast) {
      withLinks.forEach((b) => {
        if (b.date === todayStr) {
          todayBookings++;
          todayRevenue += Number(b.amount || 0);
        }
        if (b.date >= todayStr) {
          upcoming++;
        }
        if (b.date.startsWith(monthStr)) {
          monthRevenue += Number(b.amount || 0);
        }
      });
    }

    res.status(200).json({
      bookings: withLinks,
      summary: isPast
        ? null
        : {
            todayBookings,
            upcoming,
            todayRevenue,
            monthRevenue,
          },
    });
  } catch (err) {
    console.error("❌ Doctor bookings fetch error:", err);
    res.status(500).json({ error: "Database error" });
  }
}