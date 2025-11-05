console.log("✅ header-auth.js LOADED");

import { getAuth, onAuthStateChanged, signOut } 
  from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { app } from "./firebase-init.js";

window.__headerAuthLoaded = "starting";
console.log("✅ header-auth.js EXECUTING");

const auth = getAuth(app);

function renderHeader(role, name) {
  const btnBox = document.getElementById("headerButtons");
  if (!btnBox) return;

  btnBox.innerHTML = ""; // reset

  if (!role) {
    // ✅ Not logged in
    btnBox.innerHTML = `
      <a href="/signup.html" class="header-btn">Sign Up</a>
      <a href="/login.html" class="header-btn">Login</a>
    `;
    return;
  }

  // ✅ Logged in (doctor or patient)
  const dashboardLink = role === "doctor" ? "/doctor-dashboard.html" : "/dashboard.html";

  btnBox.innerHTML = `
    <a href="${dashboardLink}" class="header-btn">Dashboard</a>
    <button id="logoutBtn" class="header-btn danger">Logout</button>
  `;

  document.getElementById("logoutBtn").addEventListener("click", () => {
   sessionStorage.removeItem("doctorToken");
    sessionStorage.removeItem("patientToken");

    signOut(auth).then(() => {
      window.location.href = "/login.html";
    });
  });
}

// ✅ Ensure headerButtons exists before running auth state logic
function waitForHeaderButtons() {
  const btnBox = document.getElementById("headerButtons");
  if (!btnBox) {
    // Wait for header to be loaded
    setTimeout(waitForHeaderButtons, 100);
    return;
  }
  
  // ✅ Detect login state on every page
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      renderHeader(null);
      return;
    }

    const doctorToken = sessionStorage.getItem("doctorToken");

    if (doctorToken === user.uid) {
      renderHeader("doctor");
    } else {
      renderHeader("patient");
    }
  });
}

// Start waiting for headerButtons
waitForHeaderButtons();