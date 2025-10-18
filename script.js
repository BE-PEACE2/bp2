// Load partials (header + footer) dynamically
function loadPartial(id, file) {
  fetch(file)
    .then(response => response.text())
    .then(data => {
      document.getElementById(id).innerHTML = data;
    })
    .catch(err => console.error("Error loading partial:", err));
}

window.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("header")) {
    loadPartial("header", "../partials/header.html");
  }
  if (document.getElementById("footer")) {
    loadPartial("footer", "../partials/footer.html");
  }
});

// 🌍 Interactive 3D Tilt for Module Cards
document.querySelectorAll(".module-card").forEach(card => {
  card.addEventListener("mousemove", e => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left; 
    const y = e.clientY - rect.top;  

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * 8; 
    const rotateY = ((x - centerX) / centerX) * -8;

    card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
  });

  card.addEventListener("mouseleave", () => {
    card.style.transform = "rotateX(0deg) rotateY(0deg) scale(1)";
  });
});

// 🌍 Glow + Zoom effect on Earth icons (header & footer)
document.querySelectorAll(".earth, .footer-earth").forEach(earth => {
  earth.addEventListener("mouseenter", () => {
    earth.style.transform = "scale(1.2)";
    earth.style.filter = "drop-shadow(0 0 15px #00b4d8) drop-shadow(0 0 30px #1e90ff)";
  });

  earth.addEventListener("mouseleave", () => {
    earth.style.transform = "scale(1)";
    earth.style.filter = "drop-shadow(0 0 8px #1e90ff) drop-shadow(0 0 15px #00b4d8)";
  });
});

// Popup Handling
const bookBtn = document.getElementById("bookBtn");
const popupForm = document.getElementById("popupForm");
const closeBtn = document.getElementById("closeBtn");
const successMessage = document.getElementById("successMessage");
const closeSuccess = document.getElementById("closeSuccess");

// Run only if elements exist on the page
if (bookBtn && popupForm) {
  bookBtn.onclick = () => popupForm.style.display = "flex";
}

if (closeBtn && popupForm) {
  closeBtn.onclick = () => popupForm.style.display = "none";
}

if (closeSuccess && successMessage) {
  closeSuccess.onclick = () => successMessage.style.display = "none";
}

if (popupForm) {
  const form = popupForm.querySelector("form");
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      popupForm.style.display = "none";
      successMessage.style.display = "flex";
    };
  }
}

// Close popup when clicking outside
window.onclick = (e) => {
  if (e.target === popupForm) popupForm.style.display = "none";
  if (e.target === successMessage) successMessage.style.display = "none";
};

// Open and close popup functions
function openPopup() {
  document.getElementById("popupForm").style.display = "flex";
}

function closePopup() {
  document.getElementById("popupForm").style.display = "none";
}


// Close button click (safe check)
if (closeBtn) {
  closeBtn.addEventListener("click", closePopup);
}

// Ripple effect for module cards
document.querySelectorAll('.module-card').forEach(card => {
  card.addEventListener('click', function (e) {
    // Create ripple span
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');

    // Get click position
    const rect = card.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';

    // Add ripple to card
    card.appendChild(ripple);

    // Remove ripple after animation
    setTimeout(() => {
      ripple.remove();
    }, 600);
  });
});

// 🌟 Testimonials Data
const testimonials = [
  {
    text: '"Dr. Mahesh listened patiently and explained everything so clearly. I felt truly cared for."',
    author: "— Anjali Sharma, Gurgaon"
  },
  {
    text: '"The video consultation was smooth and convenient. I got treatment at home without stress."',
    author: "– Rahul Verma, Delhi"
  },
  {
    text: '"As first-time parents, we were anxious, but BE PEACE gave us confidence and peace of mind."',
    author: "– Priya & Karan, Mumbai"
  }
];

let tIndex = 0;
let intervalId;

// Show testimonial
function showTestimonial(index) {
  const textEl = document.getElementById("testimonial-text");
  const authorEl = document.getElementById("testimonial-author");
  const dots = document.querySelectorAll(".testimonial-dots .dot");

  if (!textEl || !authorEl) return;

  // Fade out
  textEl.classList.remove("show");
  authorEl.classList.remove("show");

  setTimeout(() => {
    textEl.innerText = testimonials[index].text;
    authorEl.innerText = testimonials[index].author;

    // Fade in
    textEl.classList.add("show");
    authorEl.classList.add("show");

    // Reset dots animation
    dots.forEach((dot, i) => {
      dot.classList.remove("active", "filling");
      void dot.offsetWidth; // reset animation
      if (i === index) {
        dot.classList.add("active", "filling");
      }
    });
  }, 300);
}

// Controls
function nextTestimonial() {
  tIndex = (tIndex + 1) % testimonials.length;
  showTestimonial(tIndex);
}

function prevTestimonial() {
  tIndex = (tIndex - 1 + testimonials.length) % testimonials.length;
  showTestimonial(tIndex);
}

// Auto-rotate
function startAutoRotate() {
  intervalId = setInterval(nextTestimonial, 3000);
}

function stopAutoRotate() {
  clearInterval(intervalId);
}

// Init
window.addEventListener("DOMContentLoaded", () => {
  const dotsContainer = document.getElementById("testimonial-dots");

  // Create dots dynamically
  testimonials.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.classList.add("dot");
    dot.setAttribute("aria-label", `Go to testimonial ${i + 1}`);
    if (i === 0) dot.classList.add("active", "filling");
    dot.addEventListener("click", () => {
      stopAutoRotate();
      tIndex = i;
      showTestimonial(tIndex);
      startAutoRotate();
    });
    dotsContainer.appendChild(dot);
  });

  showTestimonial(tIndex);
  startAutoRotate();

  const nextBtn = document.getElementById("next-testimonial");
  const prevBtn = document.getElementById("prev-testimonial");
  const testimonialDiv = document.getElementById("testimonial");

  if (nextBtn && prevBtn) {
    nextBtn.addEventListener("click", () => {
      stopAutoRotate();
      nextTestimonial();
      startAutoRotate();
    });

    prevBtn.addEventListener("click", () => {
      stopAutoRotate();
      prevTestimonial();
      startAutoRotate();
    });
  }

  // 📱 Swipe support
  let startX = 0;
  testimonialDiv.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
  });

  testimonialDiv.addEventListener("touchend", (e) => {
    let endX = e.changedTouches[0].clientX;
    let diffX = startX - endX;

    if (Math.abs(diffX) > 50) {
      stopAutoRotate();
      if (diffX > 0) nextTestimonial(); // swipe left
      else prevTestimonial();           // swipe right
      startAutoRotate();
    }
  });

  // ⌨️ Keyboard support
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") {
      stopAutoRotate();
      nextTestimonial();
      startAutoRotate();
    }
    if (e.key === "ArrowLeft") {
      stopAutoRotate();
      prevTestimonial();
      startAutoRotate();
    }
  });

  // 🖱 Pause on hover
  testimonialDiv.addEventListener("mouseenter", stopAutoRotate);
  testimonialDiv.addEventListener("mouseleave", startAutoRotate);
});

// ================= Cashfree Payment Integration =================
async function proceedToPayment() {
  const name = document.getElementById("customer_name").value;
  const email = document.getElementById("customer_email").value;
  const phone = document.getElementById("customer_phone").value;

  if (!name || !email) {
    alert("⚠️ Please enter your name and email");
    return;
  }

  try {
    // Call backend to create Cashfree order
    const res = await fetch("/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: 600, // 💰 your consultation fee
        currency: "INR",
        customer_name: name,
        customer_email: email,
        customer_phone: phone
      })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ Order creation failed:", data);
      alert("Payment initiation failed. Try again.");
      return;
    }

    // Redirect to Cashfree hosted checkout
    if (data.payment_link) {
      window.location.href = data.payment_link;
    } else {
      alert("⚠️ Could not generate payment link. Please try later.");
    }

  } catch (err) {
    console.error("⚠️ Payment error:", err);
    alert("Something went wrong. Please try again.");
  }
}

// Attach Cashfree to payment button
document.addEventListener("DOMContentLoaded", () => {
  const payBtn = document.getElementById("payBtn");
  if (payBtn) {
    payBtn.addEventListener("click", () => {
      proceedToPayment();
    });
  }
});

// ===== Back-to-Top Button =====
const backToTop = document.getElementById("back-to-top");

window.addEventListener("scroll", () => {
  if (window.scrollY > 200) {
    backToTop.classList.add("show"); // slide in
  } else {
    backToTop.classList.remove("show"); // slide out
  }
});

backToTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ===== Hamburger Menu =====
const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("nav-links");
const overlay = document.getElementById("overlay");

hamburger.addEventListener("click", () => {
  hamburger.classList.toggle("active");
  navLinks.classList.toggle("active");
  overlay.classList.toggle("active");
});

// Close menu when overlay clicked
overlay.addEventListener("click", () => {
  hamburger.classList.remove("active");
  navLinks.classList.remove("active");
  overlay.classList.remove("active");
});

// Close menu when a nav link clicked
document.querySelectorAll(".nav-links a").forEach(link => {
  link.addEventListener("click", () => {
    hamburger.classList.remove("active");
    navLinks.classList.remove("active");
    overlay.classList.remove("active");
  });
});

// --- Save pending booking before payment ---
async function savePendingBooking() {
  const bookingData = {
    name: document.getElementById("name").value,
    email: document.getElementById("email").value,
    slot: document.getElementById("slot").value,
    status: "pending"
  };

  const response = await fetch("/api/saveBooking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bookingData)
  });

  const result = await response.json();
  console.log("Booking saved:", result);
}

async function loadSlots(date) {
  // ✅ 1. Check for valid date before proceeding
  if (!date) {
    console.warn("⚠️ Skipping loadSlots() — no date provided.");
    return;
  }

  // ✅ 2. Find slot container safely
  const slotSelect = document.getElementById("slotContainer");
  if (!slotSelect) {
    console.error("❌ Slot container not found in DOM.");
    return;
  }

  try {
    console.log("📡 Fetching slots for:", date);
    const res = await fetch(`/api/get-slots?date=${date}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await res.json();

    // Clear old slots
    slotSelect.innerHTML = "";

    // ✅ 3. No available data check
    if (!data.slots || data.slots.length === 0) {
      slotSelect.innerHTML = "<p>No slots available</p>";
      return;
    }

    const now = new Date();
    const selectedDate = new Date(date);
    const todayIST = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const nowIST = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);

    // ✅ 4. Create buttons for each slot
    data.slots.forEach(slot => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `${slot.time} (Your Time)`;

      let status = (slot.status || "AVAILABLE").toUpperCase();

      // 🟥 Mark all booked slots red
      if (status === "BOOKED") {
        btn.className = "slot-btn BOOKED";
        btn.disabled = true;
        btn.title = "🚫 Already booked";
      } 
      // ⚫ Mark past slots grey
      else if (status === "PAST") {
        btn.className = "slot-btn PAST";
        btn.disabled = true;
        btn.title = "⌛ Past slot";
      } 
      // 🟩 Available (selectable)
      else {
        btn.className = "slot-btn AVAILABLE";
        btn.addEventListener("click", () => {
          document.querySelectorAll(".slot-btn.AVAILABLE").forEach(b => b.classList.remove("selected"));
          btn.classList.add("selected");
          document.getElementById("slot").value = slot.time;
          validateForm();
        });
      }

      slotSelect.appendChild(btn);
      console.log(`🕒 ${slot.time} → ${status}`);
    });
  } catch (err) {
    console.error("❌ Failed to load slots:", err);
    const slotSelect = document.getElementById("slotContainer");
    if (slotSelect) slotSelect.innerHTML = "<p>⚠️ Error loading slots</p>";
  }
}

// ✅ Load slots only on the Booking Page
window.addEventListener("DOMContentLoaded", () => {
  // Check if we are on booking.html page
  if (window.location.pathname.includes("booking.html")) {
    console.log("📅 Booking page detected — loading slots...");
    const today = new Date().toISOString().split("T")[0];
    loadSlots(today);
  } else {
    console.log("ℹ️ Not on booking page — skipping slot load.");
  }
});

// ================= BE PEACE MAIN SCRIPT v8.1 (with Auto Translation) =================

// === Load header & footer dynamically ===
function loadPartial(id, file) {
  fetch(file)
    .then(res => res.text())
    .then(html => (document.getElementById(id).innerHTML = html))
    .catch(err => console.error("Error loading partial:", err));
}
window.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("header")) loadPartial("header", "../partials/header.html");
  if (document.getElementById("footer")) loadPartial("footer", "../partials/footer.html");
});

// === 3D Card Tilt ===
document.querySelectorAll(".module-card").forEach(card => {
  card.addEventListener("mousemove", e => {
    const r = card.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const rx = ((y - r.height / 2) / r.height) * 16;
    const ry = ((x - r.width / 2) / r.width) * -16;
    card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) scale(1.05)`;
  });
  card.addEventListener("mouseleave", () => card.style.transform = "rotateX(0) rotateY(0) scale(1)");
});

// === Glow effect on Earth icons ===
document.querySelectorAll(".earth, .footer-earth").forEach(el => {
  el.addEventListener("mouseenter", () => {
    el.style.transform = "scale(1.2)";
    el.style.filter = "drop-shadow(0 0 15px #00b4d8)";
  });
  el.addEventListener("mouseleave", () => {
    el.style.transform = "scale(1)";
    el.style.filter = "drop-shadow(0 0 8px #1e90ff)";
  });
});

// === Popup form logic ===
const popupForm = document.getElementById("popupForm");
document.getElementById("bookBtn")?.addEventListener("click", () => popupForm.style.display = "flex");
document.getElementById("closeBtn")?.addEventListener("click", () => popupForm.style.display = "none");

// === Testimonials Auto Slider ===
const testimonials = [
  { text: `"Dr. Mahesh listened patiently and explained everything so clearly. I felt truly cared for."`, author: "— Anjali Sharma, Gurgaon" },
  { text: `"The video consultation was smooth and convenient. I got treatment at home without stress."`, author: "– Rahul Verma, Delhi" },
  { text: `"As first-time parents, we were anxious, but BE PEACE gave us confidence and peace of mind."`, author: "– Priya & Karan, Mumbai" }
];
let tIndex = 0, interval;
function showTestimonial(i) {
  const textEl = document.getElementById("testimonial-text");
  const authorEl = document.getElementById("testimonial-author");
  const dots = document.querySelectorAll(".testimonial-dots .dot");
  if (!textEl || !authorEl) return;
  textEl.classList.remove("show"); authorEl.classList.remove("show");
  setTimeout(() => {
    textEl.innerText = testimonials[i].text;
    authorEl.innerText = testimonials[i].author;
    textEl.classList.add("show"); authorEl.classList.add("show");
    dots.forEach((dot, d) => dot.classList.toggle("active", d === i));
  }, 250);
}
function nextT() { tIndex = (tIndex + 1) % testimonials.length; showTestimonial(tIndex); }
function startAuto() { interval = setInterval(nextT, 3000); }
window.addEventListener("DOMContentLoaded", () => {
  testimonials.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.className = "dot" + (i === 0 ? " active" : "");
    dot.onclick = () => { clearInterval(interval); tIndex = i; showTestimonial(i); startAuto(); };
    document.getElementById("testimonial-dots").appendChild(dot);
  });
  showTestimonial(tIndex); startAuto();
});

// === Cashfree Payment ===
async function proceedToPayment() {
  const name = document.getElementById("customer_name").value;
  const email = document.getElementById("customer_email").value;
  const phone = document.getElementById("customer_phone").value;
  if (!name || !email) return alert("⚠️ Please enter your name and email");
  try {
    const res = await fetch("/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 600, currency: "INR", customer_name: name, customer_email: email, customer_phone: phone })
    });
    const data = await res.json();
    if (data.payment_link) window.location.href = data.payment_link;
    else alert("⚠️ Could not generate payment link. Please try later.");
  } catch (err) { alert("Payment failed."); console.error(err); }
}
document.getElementById("payBtn")?.addEventListener("click", proceedToPayment);

// === Back To Top ===
const topBtn = document.getElementById("back-to-top");
window.addEventListener("scroll", () => topBtn.classList.toggle("show", window.scrollY > 200));
topBtn?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

// === Mobile Hamburger ===
const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("nav-links");
const overlay = document.getElementById("overlay");
hamburger?.addEventListener("click", () => {
  hamburger.classList.toggle("active");
  navLinks.classList.toggle("active");
  overlay.classList.toggle("active");
});
overlay?.addEventListener("click", () => {
  hamburger.classList.remove("active");
  navLinks.classList.remove("active");
  overlay.classList.remove("active");
});

// =====================================================================
// 🌍 BE PEACE GLOBAL TRANSLATOR (v8.1) — Works with /api/lang.js
// =====================================================================
(async function () {
  console.log("🌐 BE PEACE Translator Initialized (v8.1)");

  const mainColor = "#ff4081", accentColor = "#ff80ab";
  let userLang = localStorage.getItem("bepeace_lang") || "en";
  let userFlag = localStorage.getItem("bepeace_flag") || "🌐";

  // --- Indicator ---
  const indicator = document.createElement("div");
  indicator.id = "lang-indicator";
  indicator.style.cssText = `
    position:fixed;top:15px;right:25px;z-index:9999;
    background:${mainColor};color:white;padding:8px 14px;border-radius:16px;
    font-family:'Poppins',sans-serif;font-weight:600;font-size:13px;
    display:flex;align-items:center;gap:6px;cursor:pointer;
    box-shadow:0 4px 10px rgba(255,64,129,0.25);backdrop-filter:blur(10px);
  `;
  indicator.textContent = `${userFlag} Detecting...`;
  document.body.appendChild(indicator);

  // --- Responsive ---
  function updatePos() {
    if (window.innerWidth <= 768) {
      indicator.style.top = "auto"; indicator.style.bottom = "15px";
      indicator.style.right = "15px"; indicator.style.borderRadius = "20px";
      indicator.style.fontSize = "12px";
    } else {
      indicator.style.top = "15px"; indicator.style.bottom = "auto";
      indicator.style.right = "25px"; indicator.style.fontSize = "13px";
    }
  }
  window.addEventListener("resize", updatePos); updatePos();

  // --- Helper ---
  const flag = code => String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt()));

  // --- Detect Language ---
  async function detectLanguage() {
    try {
      const res = await fetch(`/api/lang?nocache=${Date.now()}`);
      const data = await res.json();
      const country = data.country || "Unknown";
      const flagEmoji = data.flag || "🌐";
      localStorage.setItem("bepeace_flag", flagEmoji);
      userLang = data.countryCode === "IN" ? "en" : (data.detectedLang || "en");
      indicator.textContent = `${flagEmoji} ${country} → ${userLang}`;
      localStorage.setItem("bepeace_lang", userLang);
      return userLang;
    } catch (e) {
      console.warn("⚠️ Language detection failed", e);
      return "en";
    }
  }

  // --- Translate Page ---
  async function translatePage(targetLang) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentElement && !["SCRIPT", "STYLE", "NOSCRIPT"].includes(n.parentElement.tagName) && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const texts = nodes.map(n => n.nodeValue.trim());
    if (!texts.length) return;
    try {
      const res = await fetch(`/api/lang?target=${encodeURIComponent(targetLang)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts })
      });
      const data = await res.json();
      if (data.translations) nodes.forEach((n, i) => n.nodeValue = data.translations[i] || n.nodeValue);
      console.log("✅ Page translated to:", targetLang);
    } catch (err) { console.error("❌ Translation failed:", err); }
  }

  // --- Language Dropdown (Searchable) ---
  const countryLangMap = {
    IN: "English", FR: "French", DE: "German", ES: "Spanish", IT: "Italian", CN: "Chinese (Simplified)",
    JP: "Japanese", KR: "Korean", AE: "Arabic", RU: "Russian", BR: "Portuguese", TH: "Thai", VN: "Vietnamese",
    BD: "Bengali", NP: "Nepali", PK: "Urdu", TR: "Turkish", IR: "Persian", NL: "Dutch", SE: "Swedish",
    GR: "Greek", PL: "Polish", RO: "Romanian", UA: "Ukrainian", ID: "Indonesian", MY: "Malay", PT: "Portuguese",
    SA: "Arabic", US: "English", GB: "English", MX: "Spanish", AR: "Spanish", CA: "English", NG: "English", KE: "Swahili"
  };
  const dropdown = document.createElement("div");
  dropdown.style.cssText = `
    display:none;position:fixed;background:white;border:2px solid ${accentColor};
    border-radius:12px;box-shadow:0 4px 20px rgba(255,64,129,0.25);
    z-index:9999;padding:8px;max-height:300px;overflow-y:auto;transition:all .3s ease;
  `;
  document.body.appendChild(dropdown);

  const search = document.createElement("input");
  search.placeholder = "🔍 Search language...";
  search.style.cssText = "width:100%;padding:8px;border:1px solid #eee;margin-bottom:8px;";
  dropdown.appendChild(search);

  const ul = document.createElement("ul");
  ul.style.cssText = "list-style:none;padding:0;margin:0;";
  dropdown.appendChild(ul);

  for (const [code, lang] of Object.entries(countryLangMap)) {
    const li = document.createElement("li");
    li.innerHTML = `${flag(code)} ${lang}`;
    li.style.cssText = "padding:8px 12px;cursor:pointer;border-radius:6px;";
    li.onmouseover = () => li.style.background = "#ffe6ef";
    li.onmouseout = () => li.style.background = "transparent";
    li.onclick = () => {
      dropdown.style.display = "none";
      indicator.textContent = `${flag(code)} ${lang}`;
      localStorage.setItem("bepeace_lang", lang);
      translatePage(lang);
    };
    ul.appendChild(li);
  }
  search.oninput = e => {
    const q = e.target.value.toLowerCase();
    ul.querySelectorAll("li").forEach(li => li.style.display = li.textContent.toLowerCase().includes(q) ? "flex" : "none");
  };

  indicator.onclick = e => {
    e.stopPropagation();
    const r = indicator.getBoundingClientRect();
    const mobile = window.innerWidth <= 768;
    dropdown.style.width = mobile ? "90%" : `${r.width + 80}px`;
    dropdown.style.right = mobile ? "5%" : "25px";
    dropdown.style.bottom = mobile ? "65px" : "auto";
    dropdown.style.top = mobile ? "auto" : "55px";
    dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
  };
  document.addEventListener("click", e => {
    if (!dropdown.contains(e.target) && !indicator.contains(e.target)) dropdown.style.display = "none";
  });

  // --- Detect & Translate Automatically ---
  const lang = await detectLanguage();
  if (lang && lang !== "en") await translatePage(lang);
})();