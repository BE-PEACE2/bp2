// ==================== dashboard.js (Stable Clean Build) ====================

import { auth, database } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

const greeting = document.getElementById("greeting");
const todayList = document.getElementById("todayList");
const upcomingList = document.getElementById("upcomingList");
const pastList = document.getElementById("pastList");

let refreshTimer = null;

onAuthStateChanged(auth, (user) => {
  if (!user) return (window.location.href = "login.html");

  const name = user.displayName || user.email.split("@")[0];
  greeting.textContent = `Hello ${name.toUpperCase()} 👋`;

  console.log(`📥 Fetching bookings for: ${user.email}`);
  loadBookings(user.email);

  if (!refreshTimer) {
    refreshTimer = setInterval(() => {
      if (auth.currentUser) loadBookings(auth.currentUser.email);
    }, 60000);
  }
});

// 🕒 Parse date and slot
function parseBookingDateTime(date, slot) {
  if (!date) return new Date();

  const [y, m, d] = date.split("-").map(Number);
  const match = slot?.match(/(\d{1,2})(?::(\d{2}))?\s*([AP]M)?/i);
  let hour = 0,
    minute = 0;

  if (match) {
    hour = parseInt(match[1]);
    minute = match[2] ? parseInt(match[2]) : 0;
    const ampm = match[3]?.toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
  }

  return new Date(y, m - 1, d, hour, minute);
}

// 🧠 Fetch all bookings
async function loadBookings(email) {
  todayList.textContent = "Loading consultations...";
  upcomingList.textContent = "";
  pastList.textContent = "";

  try {
    const snap = await get(ref(database, "bookings"));
    if (!snap.exists()) {
      todayList.textContent = "No consultations found.";
      return;
    }

    const data = snap.val();
    const allBookings = Object.values(data).filter(
      (b) => b && b.email && b.email.toLowerCase() === email.toLowerCase()
    );

    console.log(`✅ Found ${allBookings.length} bookings for ${email}`);

    const now = new Date();
    const today = [],
      upcoming = [],
      past = [];

    for (const b of allBookings) {
      const bookingTime = parseBookingDateTime(b.date, b.slot);
      if (!bookingTime || isNaN(bookingTime)) continue;

      const bookingDate = new Date(bookingTime.getFullYear(), bookingTime.getMonth(), bookingTime.getDate());
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (bookingDate.getTime() === todayDate.getTime()) {
        bookingTime >= now ? today.push(b) : past.push(b);
      } else if (bookingTime > now) {
        upcoming.push(b);
      } else {
        past.push(b);
      }
    }

    const sortByTime = (arr) =>
      arr.sort((a, b) => parseBookingDateTime(a.date, a.slot) - parseBookingDateTime(b.date, b.slot));

    renderList(todayList, sortByTime(today), true);
    renderList(upcomingList, sortByTime(upcoming), true);
    renderList(pastList, sortByTime(past), false);
  } catch (err) {
    console.error("❌ Error loading bookings:", err);
    todayList.textContent = "Error fetching consultations.";
  }
}

// 💬 Render lists
function renderList(container, list, isUpcoming) {
  container.innerHTML = "";
  if (!list.length) {
    container.innerHTML = `<div class="small-muted">No consultations yet.</div>`;
    return;
  }

  const now = new Date();
  list.forEach((b) => {
    const bookingTime = parseBookingDateTime(b.date, b.slot);
    const minutesUntil = (bookingTime - now) / 60000;
    const isSameDay = bookingTime.toDateString() === now.toDateString();
    const canJoin = isSameDay && minutesUntil <= 10 && minutesUntil > -60;

    let statusText =
      !isSameDay && bookingTime < now
        ? "🔴 Completed"
        : canJoin
        ? "✅ Live now"
        : bookingTime > now
        ? `⏳ Starts in ${Math.floor(minutesUntil)} min`
        : "🔴 Completed";

    const div = document.createElement("div");
    div.className = "appointment";
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
          ? `<button class="join-btn disabled" disabled>Join (10 min before)</button>`
          : ""
      }
    `;
    container.append(div);
  });
}

window.toggleMenu = () => document.getElementById("sideMenu").classList.toggle("show");
window.logout = async () => {
  await signOut(auth);
  window.location.href = "login.html";
};