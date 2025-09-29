import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;

if (!uri) {
  throw new Error("❌ MONGODB_URI is not defined in environment variables");
}
if (!dbName) {
  throw new Error("❌ DB_NAME is not defined in environment variables");
}

let client;
let db;

export default async function connectDB() {
  try {
    if (!client || !client.topology?.isConnected()) {
      console.log("🔌 Connecting to MongoDB...");
      client = new MongoClient(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      await client.connect();
      db = client.db(dbName);
      console.log("✅ MongoDB Connected to:", dbName);
    }
    return db;
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    throw err; // re-throw so API routes also fail with details
  }
}