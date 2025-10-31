// ✅ Import Firebase SDKs (unified version)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
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

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// ✅ Export for use in login/signup/dashboard
export { app, auth, database };