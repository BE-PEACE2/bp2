// File: /api/lang.js

export default async function handler(req, res) {
  const { text, target } = req.query;

  // 🚫 Disable caching (important for VPN/language change detection)
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  try {
    // 🧭 STEP 1 — Get client’s actual IP (works on Vercel, Cloudflare, etc.)
    let clientIP =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.headers["x-real-ip"] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      "";

    // STEP 2 — Use fallback if running locally or IP hidden
    const ipapiURL =
      clientIP && !clientIP.includes("::1") && !clientIP.startsWith("127.")
        ? `https://ipapi.co/${clientIP}/json/`
        : `https://ipapi.co/json/`;

    // 🌍 STEP 3 — Fetch geolocation + language info
    const locationData = await fetch(ipapiURL).then(r => r.json());

    const detectedLang = locationData.languages
      ? locationData.languages.split(",")[0].split("-")[0]
      : "en";

    // If no text param, just return location info
    if (!text) {
      return res.status(200).json({
        ip: clientIP,
        country: locationData.country_name || "Unknown",
        countryCode: locationData.country_code || "??",
        detectedLang,
        message: `🌍 Detected language: ${detectedLang} from ${locationData.country_name || "Unknown"}`,
        flag: locationData.country_code
          ? String.fromCodePoint(...[...locationData.country_code].map(c => 127397 + c.charCodeAt()))
          : "🌐",
        cacheBypass: new Date().toISOString(), // forces unique response
      });
    }

    // 🌐 STEP 4 — Translate text using Google Translate API
    const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${
      target || detectedLang
    }&dt=t&q=${encodeURIComponent(text)}`;

    const response = await fetch(translateUrl);
    const data = await response.json();

    const translatedText =
      Array.isArray(data[0]) && Array.isArray(data[0][0])
        ? data[0].map(t => t[0]).join(" ")
        : text;

    // ✅ STEP 5 — Return translation + metadata
    return res.status(200).json({
      ip: clientIP,
      original: text,
      translated: translatedText,
      from: data[2] || "auto",
      to: target || detectedLang,
      detectedLang,
      location: locationData.country_name || "Unknown",
      flag: locationData.country_code
        ? String.fromCodePoint(...[...locationData.country_code].map(c => 127397 + c.charCodeAt()))
        : "🌐",
      cacheBypass: new Date().toISOString(), // prevents CDN caching
    });
  } catch (err) {
    console.error("❌ Translation error:", err);
    return res.status(500).json({
      error: "Translation service failed.",
      details: err.message,
    });
  }
}