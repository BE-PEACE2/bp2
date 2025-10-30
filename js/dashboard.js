// ==================== dashboard.js (Final Stable Production Build) ====================

// Import Firebase
import { auth, database } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";

// DOM elements
const greeting = document.getElementById("greeting");
const todayList = document.getElementById("todayList");
const upcomingList = document.getElementById("upcomingList");
const pastList = document.getElementById("pastList");

let refreshTimer = null;

// ================== AUTH WATCH (SINGLE TRIGGER) ==================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const name = user.displayName || user.email.split("@")[0];
  greeting.textContent = `Hello ${name.toUpperCase()} 👋`;

  console.log(`📥 Fetching bookings for: ${user.email}`);
  loadBookings(user.email);

  // ⏳ Start auto-refresh once
  if (!refreshTimer) {
    refreshTimer = setInterval(() => {
      if (auth.currentUser) loadBookings(auth.currentUser.email);
    }, 60000); // every 1 minute
  }
});

// ================== DATE PARSER (SAFE FOR MULTI FORMATS) ==================
function parseBookingDateTime(datePart, slot) {
  if (!datePart) return new Date();

  const sp = String(slot || "12:00 AM").trim().toUpperCase();
  let [y, m, d] = [0, 0, 0];
  const parts = datePart.split(/[-/]/).map(Number);

  if (parts[0] > 1900) [y, m, d] = parts;
  else if (parts[2] > 1900) [d, m, y] = parts;
  else return new Date(datePart + " " + sp);

  let hour = 0, minute = 0;
  const match = sp.match(/(\d{1,2})(?::(\d{2}))?\s*([AP]M)?/);
  if (match) {
    hour = parseInt(match[1], 10);
    minute = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3];
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
  }

  return new Date(y, m - 1, d, hour, minute);
}

// ================== LOAD BOOKINGS ==================
async function loadBookings(email) {
  const startTime = performance.now();
  try {
    const bookingsRef = ref(database, "bookings");
    const snapshot = await get(bookingsRef);

   // ✅ Safe JSON clone that avoids Firebase circular structures
const raw = snapshot.val() || {};
const data = {};

Object.keys(raw).forEach((key) => {
  try {
    const val = raw[key];

    // skip unwanted Firebase meta or cyclic objects
    if (!val || typeof val !== "object" || key.startsWith(".") || key === "connection-test") return;

    // deep clone safely
    data[key] = JSON.parse(JSON.stringify(val));
  } catch (err) {
    console.warn(`⚠️ Skipped problematic key "${key}":`, err.message);
  }
});
    const allBookings = [];

    // Flatten nested Firebase data safely
    Object.entries(data).forEach(([key, val]) => {
      if (key === "connection-test") return;

      if (val && typeof val === "object" && val.email) {
        allBookings.push(val);
      } else if (val && typeof val === "object") {
        Object.values(val).forEach((v) => {
          if (v && typeof v === "object" && v.email) allBookings.push(v);
        });
      }
    });

    // 🎯 Filter bookings for this user
    const userBookings = allBookings.filter(
      (b) => b.email && b.email.toLowerCase() === email.toLowerCase()
    );

    if (!userBookings.length) {
      todayList.textContent = "No consultations found.";
      upcomingList.textContent = "";
      pastList.textContent = "";
      return;
    }

    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`✅ Found ${userBookings.length} bookings for ${email} in ${duration}ms`);

    // Categorize bookings
    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const today = [], upcoming = [], past = [];

    userBookings.forEach((b) => {
      try {
        const bookingDateTime = parseBookingDateTime(b.date, b.slot);
        const bookingDate = new Date(
          bookingDateTime.getFullYear(),
          bookingDateTime.getMonth(),
          bookingDateTime.getDate()
        );

        if (bookingDate.getTime() === todayDate.getTime()) {
          bookingDateTime >= now ? today.push(b) : past.push(b);
        } else if (bookingDateTime > now) {
          upcoming.push(b);
        } else {
          past.push(b);
        }
      } catch (err) {
        console.warn("⚠️ Skipping invalid booking:", b);
      }
    });

    const sortByDate = (arr) =>
      arr.sort((a, b) => parseBookingDateTime(a.date, a.slot) - parseBookingDateTime(b.date, b.slot));

    renderList(todayList, sortByDate(today), true);
    renderList(upcomingList, sortByDate(upcoming), true);
    renderList(pastList, sortByDate(past), false);

  } catch (error) {
    console.error("❌ Error fetching bookings:", error);
    todayList.textContent = "Unable to load consultations.";
    upcomingList.textContent = "";
    pastList.textContent = "";
  }
}

// ================== RENDER BOOKINGS ==================
function renderList(container, list, isUpcoming) {
  container.innerHTML = "";
  if (!list.length) {
    container.innerHTML = `<div class="small-muted">No consultations yet.</div>`;
    return;
  }

  const now = new Date();

  list.forEach((b) => {
    try {
      const div = document.createElement("div");
      div.className = "appointment";

      const bookingTime = parseBookingDateTime(b.date, b.slot);
      const minutesUntil = (bookingTime - now) / 60000;
      const canJoin = minutesUntil <= 10 && minutesUntil > -60;

      let statusText =
        minutesUntil > 10
          ? `⏳ Starts in ${Math.floor(minutesUntil)} min`
          : canJoin
          ? "✅ Live now"
          : "🔴 Completed";

      div.innerHTML = `
        <div>
          <strong>${b.name || "Consultation"}</strong><br>
          ${b.date} • ${b.slot}<br>
          <span class="status">${b.status || "confirmed"}</span><br>
          <span class="countdown">${statusText}</span>
        </div>
        ${
          isUpcoming && canJoin
            ? `<button class="join-btn live" onclick="window.open('https://meet.bepeace.in/bepeace-${b.order_id}','_blank')">Join</button>`
            : isUpcoming
            ? `<button class="join-btn disabled" disabled>Join (available 10 min before)</button>`
            : ""
        }
      `;
      container.append(div);
    } catch (err) {
      console.warn("⚠️ Error rendering booking:", err);
    }
  });
}

// ================== MENU + LOGOUT ==================
window.toggleMenu = () => {
  document.getElementById("sideMenu").classList.toggle("show");
};

window.logout = async () => {
  await signOut(auth);
  window.location.href = "login.html";
};