import { auth, database } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";

const greeting = document.getElementById("greeting");
const upcomingList = document.getElementById("upcomingList");
const pastList = document.getElementById("pastList");

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const name = user.displayName || user.email.split("@")[0];
  greeting.textContent = `Hello ${name} 👋`;
  loadBookings(user.email);
});

function loadBookings(email) {
  const bookingsRef = ref(database, "bookings");
  onValue(bookingsRef, (snapshot) => {
    if (!snapshot.exists()) {
      upcomingList.textContent = "No upcoming consultations.";
      return;
    }

    const allBookings = snapshot.val();
    const userBookings = Object.values(allBookings).filter(
      (b) => b.email && b.email.toLowerCase() === email.toLowerCase()
    );

    const now = new Date();
    const upcoming = [];
    const past = [];

    userBookings.forEach((b) => {
      const dt = new Date(b.date);
      if (dt >= now) upcoming.push(b);
      else past.push(b);
    });

    renderList(upcomingList, upcoming, true);
    renderList(pastList, past, false);
  });
}

function renderList(container, list, isUpcoming) {
  container.innerHTML = "";
  if (!list.length) {
    container.innerHTML = `<div class='small-muted'>No consultations yet.</div>`;
    return;
  }

  list.forEach((b) => {
    const div = document.createElement("div");
    div.className = "appointment";
    div.innerHTML = `
      <div><strong>${b.name || "Consultation"}</strong><br>${b.date} • ${b.slot}</div>
      ${isUpcoming ? `<button class="join-btn" onclick="window.open('https://meet.bepeace.in/bepeace-${b.order_id}','_blank')">Join</button>` : ""}
    `;
    container.append(div);
  });
}

window.toggleMenu = function () {
  document.getElementById("sideMenu").classList.toggle("show");
};

window.logout = async function () {
  await signOut(auth);
  window.location.href = "login.html";
};