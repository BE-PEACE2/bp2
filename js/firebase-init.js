// ✅ Import Firebase SDKs (v12 modular)
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

// ✅ BePeace Firebase Configuration (your unique keys)
const firebaseConfig = {
  apiKey: "AIzaSyBE_Sn2MXGqkLZenbqN8hpqswwjm6BfIk0",
  authDomain: "bepeace-65238.firebaseapp.com",
  databaseURL: "https://bepeace-65238-default-rtdb.asia-southeast1.firebasedatabase.app",  // 👈 ADD THIS LINE
  projectId: "bepeace-65238",
  storageBucket: "bepeace-65238.appspot.com",  // 👈 FIXED suffix from `.firebasestorage.app` → `.appspot.com`
  messagingSenderId: "199738070495",
  appId: "1:199738070495:web:606db05feda8fe6899206a",
  measurementId: "G-CT6YH2ENVK"
};

// ✅ Initialize Firebase (re-use if already exists)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// ✅ Initialize Auth + Database
const auth = getAuth(app);
const database = getDatabase(app);

// ✅ Ensure login persistence across reloads
setPersistence(auth, browserLocalPersistence).catch((err) =>
  console.warn("⚠️ Auth persistence error:", err)
);

// 🌍 Make available globally for debugging & other scripts
window.firebaseApp = app;
window.auth = auth;
window.database = database;

// ✅ Export for use in login/signup/dashboard
export { app, auth, database };

console.log("✅ Firebase initialized successfully for BePeace.");