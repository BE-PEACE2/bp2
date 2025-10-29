// ==================== dashboard.js ====================

// Import Firebase modules
import { auth, database } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  ref,
  get,
  query,
  orderByChild,
  equalTo
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";

// Get DOM elements
const greeting = document.getElementById("greeting");
const todayList = document.getElementById("todayList");
const upcomingList = document.getElementById("upcomingList");
const pastList = document.getElementById("pastList");

// ================== AUTH WATCH ==================
onAuthStateChanged(auth, (user) => {
  console.log("🔐 Authenticated user:", user ? user.email : "No user");
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const name = user.displayName || user.email.split("@")[0];
  greeting.textContent = `Hello ${name} 👋`;
  loadBookings(user.email);
});

// ================== FETCH BOOKINGS ==================
// Helper: parse booking date + slot reliably in local timezone
function parseBookingDateTime(datePart, slot) {
  // datePart expected "YYYY-MM-DD"
  // slot examples: "10:00 PM", "10:00PM", "03:30 AM", "12:00 AM", "09:00"
  const dp = String(datePart || "").trim();
  const sp = String(slot || "12:00 AM").toUpperCase().replace(/\s+/g, " ").trim();

  const dateParts = dp.split("-").map((n) => parseInt(n, 10));
  if (dateParts.length !== 3 || dateParts.some(isNaN)) {
    // fallback to Date constructor if format unexpected
    return new Date(`${dp} ${sp}`);
  }

  let hour = 0, minute = 0;
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
  // Create a local Date using the numeric parts (avoids UTC midnight issues)
  return new Date(dateParts[0], dateParts[1] - 1, dateParts[2], hour, minute, 0, 0);
}

function loadBookings(email) {
  const bookingsRef = ref(database, "bookings");
  const userQuery = query(bookingsRef, orderByChild("email"), equalTo(email.toLowerCase()));

  get(userQuery)
    .then((snapshot) => {
      if (!snapshot.exists()) {
        todayList.textContent = "No consultations today.";
        upcomingList.textContent = "No upcoming consultations.";
        pastList.textContent = "No past consultations.";
        return;
      }

      const allBookings = snapshot.val();
      console.log("📬 Logged in email:", email);
      console.log("🗂️ Bookings fetched for this user:", allBookings);

      const now = new Date();
      // todayDate as local midnight (year, month, date) — IMPORTANT fix
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const today = [];
      const upcoming = [];
      const past = [];

      Object.values(allBookings).forEach((b) => {
        try {
          // Use robust parser (local timezone)
          const datePart = b.date; // "YYYY-MM-DD"
          const slot = b.slot || "12:00 AM";
          const bookingDateTime = parseBookingDateTime(datePart, slot);

          // bookingDate = local midnight for that booking day
          const bookingDate = new Date(bookingDateTime.getFullYear(), bookingDateTime.getMonth(), bookingDateTime.getDate());

          // If booking is on the same local day as today
          if (bookingDate.getTime() === todayDate.getTime()) {
            // If its time is still in future or now -> today's upcoming
            if (bookingDateTime >= now) {
              today.push(b);
            } else {
              // earlier today -> past
              past.push(b);
            }
          } else if (bookingDateTime > now) {
            // future (not today)
            upcoming.push(b);
          } else {
            // past
            past.push(b);
          }
        } catch (err) {
          console.warn("⚠️ Invalid booking date:", b, err);
        }
      });

      // Optional: sort lists by date/time ascending
      const sortByDateTime = (arr) => arr.sort((x, y) => {
        const dx = parseBookingDateTime(x.date, x.slot).getTime();
        const dy = parseBookingDateTime(y.date, y.slot).getTime();
        return dx - dy;
      });

      sortByDateTime(today);
      sortByDateTime(upcoming);
      sortByDateTime(past);

      renderList(todayList, today, true);
      renderList(upcomingList, upcoming, true);
      renderList(pastList, past, false);
    })
    .catch((error) => {
      console.error("❌ Error fetching bookings:", error);
      todayList.textContent = "Unable to load consultations.";
      upcomingList.textContent = "";
      pastList.textContent = "";
    });
}

// ================== RENDER LIST ==================
function renderList(container, list, isUpcoming) {
  container.innerHTML = "";
  if (!list.length) {
    container.innerHTML = `<div class='small-muted'>No consultations yet.</div>`;
    return;
  }

  const now = new Date();

  list.forEach((b) => {
    try {
      const div = document.createElement("div");
      div.className = "appointment";

      const datePart = b.date;
      const timePart =
        b.slot?.replace("AM", " AM").replace("PM", " PM") || "12:00 AM";
      const bookingTime = new Date(`${datePart} ${timePart}`);

      const minutesUntil = (bookingTime - now) / 60000;
      const canJoin = minutesUntil <= 10 && minutesUntil > -60;

      let statusText = "";
      if (minutesUntil > 10) {
        statusText = `⏳ Starts in ${Math.floor(minutesUntil)} min`;
      } else if (canJoin) {
        statusText = "✅ Live now";
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

// 🔁 AUTO REFRESH LIST EVERY 1 MINUTE
setInterval(() => {
  const user = auth.currentUser;
  if (user) loadBookings(user.email);
}, 60000);

// ================== MENU + LOGOUT ==================
window.toggleMenu = function () {
  document.getElementById("sideMenu").classList.toggle("show");
};

window.logout = async function () {
  await signOut(auth);
  window.location.href = "login.html";
};