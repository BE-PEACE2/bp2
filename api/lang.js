// File: /api/lang.js

// In-memory 1-hour cache (auto resets when server restarts)
const cache = new Map();

export default async function handler(req, res) {
  const { text, target } = req.query;

  try {
    // 🗺️ STEP 1: Get client IP safely
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.headers["x-real-ip"] ||
      req.socket.remoteAddress ||
      "unknown";

    // 🕐 STEP 2: Use cached data if available (1 hour)
    const cached = cache.get(ip);
    if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) {
      console.log(`⚡ Using cached location for ${ip}`);
      return handleResponse(req, res, cached.data);
    }

    // 🧭 STEP 3: Detect location using fallback APIs
    const locationData = await detectLocation();

    // 🏳️ Extract values
    const detectedLang =
      locationData.languages?.split(",")[0].split("-")[0] || "en";
    const country = locationData.country_name || "India";
    const countryCode = locationData.country_code || "IN";
    const flag = getFlagEmoji(countryCode);

    // 💾 Save in cache
    const data = { detectedLang, country, countryCode, flag };
    cache.set(ip, { data, timestamp: Date.now() });

    // 🧩 STEP 4: Handle translation or detection-only
    return handleResponse(req, res, data);
  } catch (err) {
    console.error("❌ Translation error:", err);
    return res.status(500).json({
      error: "Translation service failed.",
      details: err.message
    });
  }
}

// =============================
// 🌍 LOCATION DETECTION SECTION
// =============================
async function detectLocation() {
  const sources = [
    "https://ipapi.co/json/",
    "https://ipwho.is/",
    "https://ipapi.com/ip_api.php?format=json"
  ];

  for (const url of sources) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json && (json.country_name || json.country)) {
          console.log(`✅ Location source: ${url}`);
          return normalizeLocation(json);
        }
      } catch {
        console.warn(`⚠️ ${url} returned invalid JSON`);
      }
    } catch (err) {
      console.warn(`⚠️ Failed ${url}: ${err.message}`);
    }
  }

  console.warn("⚠️ All APIs failed, using default (India).");
  return { country_name: "India", country_code: "IN", languages: "en" };
}

// Normalize fields across APIs
function normalizeLocation(data) {
  return {
    country_name:
      data.country_name || data.country || data.countryName || "Unknown",
    country_code:
      data.country_code ||
      data.countryCode ||
      data.country_code_iso2 ||
      "XX",
    languages:
      data.languages ||
      data.language ||
      (Array.isArray(data.languages_spoken)
        ? data.languages_spoken.join(",")
        : "en")
  };
}

// =============================
// 🌐 RESPONSE HANDLER
// =============================
async function handleResponse(req, res, locationData) {
  const { text, target } = req.query;
  const { detectedLang, country, countryCode, flag } = locationData;

  // Only detection (no text)
  if (!text) {
    return res.status(200).json({
      detectedLang,
      country,
      countryCode,
      flag,
      cached: true,
      message: `🌍 Detected ${detectedLang.toUpperCase()} from ${country}`
    });
  }

  // Translation case
  const tl = target || detectedLang || "en";
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(
    text
  )}`;

  try {
    const response = await fetch(url);
    const raw = await response.text();
    const translated = parseGoogleTranslate(raw);

    return res.status(200).json({
      original: text,
      translated,
      detectedLang,
      to: tl,
      country,
      countryCode,
      flag,
      cached: false
    });
  } catch (err) {
    console.warn("⚠️ Translation API failed:", err);
    return res.status(500).json({
      error: "Translation failed",
      details: err.message
    });
  }
}

// =============================
// 🔤 UTILITIES
// =============================
function getFlagEmoji(code = "IN") {
  try {
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt()));
  } catch {
    return "🌐";
  }
}

function parseGoogleTranslate(raw) {
  try {
    const match = raw.match(/\[\[\["(.*?)"/);
    if (match && match[1]) return match[1];
  } catch {
    console.warn("⚠️ Failed to parse translation output");
  }
  return raw.slice(0, 200);
}