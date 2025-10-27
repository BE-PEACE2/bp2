// utils/firebase-admin.js
import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";

let serviceAccount;

try {
  // ✅ 1. Load from environment (for Vercel)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } 
  // ✅ 2. Load from local file (for local development)
  else if (existsSync("utils/serviceAccountKey.json")) {
    const fileContent = readFileSync("utils/serviceAccountKey.json", "utf8");
    serviceAccount = JSON.parse(fileContent);
  } 
  else {
    throw new Error("❌ Firebase service account key not found");
  }

  // ✅ 3. Initialize Firebase Admin SDK only once
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://bepeace-65238-default-rtdb.asia-southeast1.firebasedatabase.app",
    });
    console.log("🔥 Firebase Admin connected successfully");
  }
} catch (error) {
  console.error("💥 Firebase Admin initialization error:", error.message);
}

export const db = admin.database();
export const authAdmin = admin.auth();