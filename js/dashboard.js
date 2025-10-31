// ==================== dashboard.js (Final Optimized Production Build) ====================

// Import Firebase
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

// DOM elements
const greeting = document.getElementById("greeting");
const todayList = document.getElementById("todayList");
const upcomingList = document.getElementById("upcomingList");
const pastList = document.getElementById("pastList");

let refreshTimer = null;

// ================== AUTH WATCH ==================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const name = user.displayName || user.email.split("@")[0];
  greeting.textContent = `Hello ${name.toUpperCase()} 👋`;

  console.log(`📥 Fetching bookings for: ${user.email}`);
  loadBookings(user.email);

  // Auto-refresh every 1 minute
  if (!refreshTimer) {
    refreshTimer = setInterval(() => {
      if (auth.currentUser) loadBookings(auth.currentUser.email);
    }, 60000);
  }
});

// ================== DATE PARSER ==================
function parseBookingDateTime(datePart, slot) {
  if (!datePart) return new Date();

  const sp = String(slot || "12:00 AM").trim().toUpperCase();
  let [y, m, d] = [0, 0, 0];
  const parts = datePart.split(/[-/]/).map(Number);

  if (parts[0] > 1900) [y, m, d] = parts;
  else if (parts[2] > 1900) [d, m, y] = parts;
  else return new Date(datePart + " " + sp);

  let hour = 0,
    minute = 0;
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

// ================== LOAD BOOKINGS (Optimized) ==================
async function loadBookings(email) {
  const startTime = performance.now();
  todayList.textContent = "Loading consultations...";
  upcomingList.textContent = "";
  pastList.textContent = "";

  try {
    // 🎯 Fetch only the bookings of the logged-in user
    const bookingsRef = ref(database, "bookings");
    const userQuery = query(bookingsRef, orderByChild("email"), equalTo(email));
    const snapshot = await get(userQuery);

    if (!snapshot.exists()) {
      todayList.textContent = "No consultations found.";
      return;
    }

    // ✅ Convert snapshot safely into plain JSON
    const userBookings = Object.values(snapshot.val());
    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`✅ Found ${userBookings.length} bookings for ${email} in ${duration}ms`);

    // Categorize bookings
    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
        console.warn("⚠️ Skipping invalid booking:", b);
      }
    });

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
    console.error("❌ Error fetching bookings:", error);
    todayList.textContent = "Unable to load consultations.";
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

      // ✅ “Live now” only for today’s date
      const isSameDay = bookingTime.toDateString() === now.toDateString();
      const canJoin = isSameDay && minutesUntil <= 10 && minutesUntil > -60;

      let statusText;
      if (!isSameDay && bookingTime < now) {
        statusText = "🔴 Completed";
      } else if (canJoin) {
        statusText = "✅ Live now";
      } else if (bookingTime > now) {
        statusText = `⏳ Starts in ${Math.floor(minutesUntil)} min`;
      } else {
        statusText = "🔴 Completed";
      }

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