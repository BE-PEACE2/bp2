// ==================== dashboard.js (Final Debug + Optimized Version) ====================

// Import Firebase modules
import { auth, database } from "./firebase-init.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  ref,
  get,
  query,
  orderByChild,
  equalTo,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";

// Get DOM elements
const greeting = document.getElementById("greeting");
const todayList = document.getElementById("todayList");
const upcomingList = document.getElementById("upcomingList");
const pastList = document.getElementById("pastList");

// ================== AUTH WATCH ==================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const name = user.displayName || user.email.split("@")[0];
  greeting.textContent = `Hello ${name.toUpperCase()} 👋`;
  loadBookings(user.email);
});

// ================== DATE PARSER ==================
function parseBookingDateTime(datePart, slot) {
  const dp = String(datePart || "").trim();
  const sp = String(slot || "12:00 AM")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  const dateParts = dp.split("-").map((n) => parseInt(n, 10));
  if (dateParts.length !== 3 || dateParts.some(isNaN))
    return new Date(`${dp} ${sp}`);

  let hour = 0,
    minute = 0;
  const m = sp.match(/(\d{1,2}):?(\d{2})?\s*([AP]M)?/);
  if (m) {
    hour = parseInt(m[1], 10);
    minute = m[2] ? parseInt(m[2], 10) : 0;
    const ampm = m[3];
    if (ampm) {
      if (ampm === "PM" && hour !== 12) hour += 12;
      if (ampm === "AM" && hour === 12) hour = 0;
    }
  }

  return new Date(dateParts[0], dateParts[1] - 1, dateParts[2], hour, minute);
}

// ================== FETCH BOOKINGS ==================
async function loadBookings(email) {
  const startTime = performance.now();
  try {
    console.log(
      `%c🔍 Fetching bookings for: %c${email}`,
      "color: #7c3aed; font-weight: bold;",
      "color: #2563eb;"
    );

    const bookingsRef = ref(database, "bookings");
    const userQuery = query(
      bookingsRef,
      orderByChild("email"),
      equalTo(email.toLowerCase())
    );
    const snapshot = await get(userQuery);

    const duration = ((performance.now() - startTime) / 1000).toFixed(2);

    if (!snapshot.exists()) {
      console.log(
        `%c⚠️ No consultations found for ${email} (⏱️ ${duration}s)`,
        "color: #f59e0b; font-weight: bold;"
      );
      todayList.textContent = "No consultations today.";
      upcomingList.textContent = "No upcoming consultations.";
      pastList.textContent = "No past consultations.";
      return;
    }

    const rawData = snapshot.val();
    const jsonString = JSON.stringify(rawData);
    const dataSizeKB = (jsonString.length / 1024).toFixed(2);
    const userBookings = Object.values(rawData || {});

    console.log(
      `%c✅ Found %c${userBookings.length}%c bookings for %c${email}\n⏱️ %c${duration}s %c| 💾 ${dataSizeKB} KB fetched`,
      "color: #22c55e; font-weight: bold;",
      "color: #16a34a; font-weight: bold;",
      "color: #22c55e;",
      "color: #2563eb;",
      "color: #10b981; font-weight: bold;",
      "color: #6b7280;"
    );

    console.table(
      userBookings.map((b) => ({
        Date: b.date,
        Slot: b.slot,
        Status: b.status,
        Name: b.name,
      }))
    );

    // ================= Categorize Consultations =================
    const now = new Date();
    const todayDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const today = [],
      upcoming = [],
      past = [];

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
        console.warn("%c⚠️ Skipping invalid booking:", "color: #eab308;", b);
      }
    });

    // ================= Sort and Render =================
    const sortByDate = (arr) =>
      arr.sort(
        (a, b) =>
          parseBookingDateTime(a.date, a.slot) -
          parseBookingDateTime(b.date, b.slot)
      );

    renderList(todayList, sortByDate(today), true);
    renderList(upcomingList, sortByDate(upcoming), true);
    renderList(pastList, sortByDate(past), false);
  } catch (error) {
    const duration = ((performance.now() - startTime) / 1000).toFixed(2);
    console.error(
      `%c❌ Error fetching bookings after ${duration}s:`,
      "color: #ef4444; font-weight: bold;",
      error
    );
    todayList.textContent = "Unable to load consultations.";
    upcomingList.textContent = "";
    pastList.textContent = "";
  }
}

// ================== RENDER LIST ==================
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

// 🔁 AUTO REFRESH LIST EVERY 1 MINUTE
setInterval(() => {
  const user = auth.currentUser;
  if (user) loadBookings(user.email);
}, 60000);

// ================== MENU + LOGOUT ==================
window.toggleMenu = () => {
  document.getElementById("sideMenu").classList.toggle("show");
};

window.logout = async () => {
  await signOut(auth);
  window.location.href = "login.html";
};