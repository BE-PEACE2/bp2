// db.js
const { MongoClient } = require("mongodb");
require("dotenv").config();

let client;
let db;

async function connectDB() {
  if (db) return db; // Reuse existing connection

  try {
    client = new MongoClient(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await client.connect();

    // ✅ Use DB_NAME from environment variables
    db = client.db(process.env.DB_NAME);

    console.log(`✅ MongoDB connected to database: ${process.env.DB_NAME}`);
    return db;
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    throw err;
  }
}

module.exports = connectDB;