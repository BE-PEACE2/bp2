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

// ================= 🌍 BE PEACE Global Translator (200+ Languages + Dual Pulse Animation) =================
(async function () {
  console.log("🌍 Initializing BE PEACE Translator...");

  const mainColor = "#ff4081";
  const accentColor = "#ff80ab";

  // 🌐 Floating container
  const container = document.createElement("div");
  container.style.cssText = `
    position:fixed;top:15px;right:25px;display:flex;align-items:center;
    gap:6px;z-index:9999;transition:opacity 0.3s ease;
  `;

  // 🌐 Language Indicator
  const indicator = document.createElement("div");
  indicator.id = "lang-indicator";
  indicator.style.cssText = `
    background:${mainColor};color:white;padding:7px 12px;border-radius:12px;
    font-family:'Poppins',sans-serif;font-weight:600;font-size:13px;
    display:flex;align-items:center;gap:6px;cursor:pointer;
    box-shadow:0 4px 10px rgba(255,64,129,0.25);
    backdrop-filter:blur(10px);transition:all 0.3s ease;
  `;
  indicator.textContent = "🌐 Detecting...";

  // 🔁 Refresh button (hidden until hover)
  const refreshBtn = document.createElement("button");
  refreshBtn.innerHTML = "🔁";
  refreshBtn.title = "Refresh Translation";
  refreshBtn.style.cssText = `
    background:${accentColor};color:white;border:none;
    border-radius:10px;padding:6px 8px;cursor:pointer;
    font-size:13px;font-weight:bold;opacity:0;
    transform:scale(0.8);transition:all 0.3s ease;
    box-shadow:0 2px 5px rgba(255,128,171,0.3);
  `;

  container.appendChild(indicator);
  container.appendChild(refreshBtn);
  document.body.appendChild(container);

  // 🪄 Hover Animation: show refresh on hover
  container.addEventListener("mouseenter", () => {
    refreshBtn.style.opacity = "1";
    refreshBtn.style.transform = "scale(1)";
  });
  container.addEventListener("mouseleave", () => {
    refreshBtn.style.opacity = "0";
    refreshBtn.style.transform = "scale(0.8)";
  });

  // ✨ Add pulse animation for both indicator & button
  const style = document.createElement("style");
  style.innerHTML = `
    @keyframes pulse {
      0% { transform: scale(1); box-shadow: 0 0 5px ${accentColor}; }
      50% { transform: scale(1.2); box-shadow: 0 0 18px ${accentColor}; }
      100% { transform: scale(1); box-shadow: 0 0 5px ${accentColor}; }
    }
    .pulse-anim {
      animation: pulse 1s infinite ease-in-out;
    }
  `;
  document.head.appendChild(style);

  // 🗺️ Detect user language
  let userLang = "en", country = "", flag = "🌐";
  async function detectLanguage() {
    try {
      indicator.classList.add("pulse-anim");
      const res = await fetch(`/api/lang?nocache=${Date.now()}`, {
        headers: { "Cache-Control": "no-cache" }
      });
      const data = await res.json();
      userLang = data.detectedLang || "en";
      country = data.country || "";
      flag = data.flag || "🌐";
      indicator.textContent = `${flag} ${userLang.toUpperCase()} ▼`;
      indicator.classList.remove("pulse-anim");
      return userLang;
    } catch {
      indicator.textContent = "🌐 EN ▼";
      indicator.classList.remove("pulse-anim");
      return "en";
    }
  }

  await detectLanguage();

  // 🔽 Dropdown setup
  const dropdown = document.createElement("div");
  dropdown.id = "lang-dropdown";
  dropdown.style.cssText = `
    display:none;position:fixed;top:50px;right:25px;background:white;
    border:2px solid ${accentColor};border-radius:10px;
    box-shadow:0 4px 20px rgba(255,64,129,0.2);
    z-index:9999;padding:8px;width:250px;max-height:300px;overflow-y:auto;
  `;
  document.body.appendChild(dropdown);

  const search = document.createElement("input");
  search.type = "text";
  search.placeholder = "Search language...";
  search.style.cssText = `
    width:100%;padding:6px;border:1px solid ${accentColor};
    border-radius:8px;margin-bottom:8px;
  `;
  dropdown.appendChild(search);

  // 🌍 Supported languages
  const languages = {
    af:"Afrikaans", am:"Amharic", ar:"Arabic", as:"Assamese", ay:"Aymara", az:"Azerbaijani",
    be:"Belarusian", bg:"Bulgarian", bho:"Bhojpuri", bn:"Bengali", bs:"Bosnian", ca:"Catalan",
    ceb:"Cebuano", ckb:"Kurdish (Sorani)", co:"Corsican", cs:"Czech", cy:"Welsh", da:"Danish",
    de:"German", doi:"Dogri", dv:"Dhivehi", ee:"Ewe", el:"Greek", en:"English", eo:"Esperanto",
    es:"Spanish", et:"Estonian", eu:"Basque", fa:"Persian", fi:"Finnish", fil:"Filipino",
    fr:"French", fy:"Frisian", ga:"Irish", gd:"Scottish Gaelic", gl:"Galician", gn:"Guarani",
    gom:"Konkani", gu:"Gujarati", ha:"Hausa", haw:"Hawaiian", he:"Hebrew", hi:"Hindi",
    hmn:"Hmong", hr:"Croatian", ht:"Haitian Creole", hu:"Hungarian", hy:"Armenian",
    id:"Indonesian", ig:"Igbo", ilo:"Ilocano", is:"Icelandic", it:"Italian", ja:"Japanese",
    jv:"Javanese", ka:"Georgian", kk:"Kazakh", km:"Khmer", kn:"Kannada", ko:"Korean",
    kri:"Krio", ku:"Kurdish (Kurmanji)", ky:"Kyrgyz", la:"Latin", lb:"Luxembourgish",
    lg:"Luganda", ln:"Lingala", lo:"Lao", lt:"Lithuanian", lus:"Mizo", lv:"Latvian",
    mai:"Maithili", mg:"Malagasy", mi:"Maori", mk:"Macedonian", ml:"Malayalam", mn:"Mongolian",
    mni:"Meitei (Manipuri)", mr:"Marathi", ms:"Malay", mt:"Maltese", my:"Burmese", ne:"Nepali",
    nl:"Dutch", no:"Norwegian", nso:"Northern Sotho", ny:"Nyanja (Chichewa)", om:"Oromo",
    or:"Odia (Oriya)", pa:"Punjabi", pap:"Papiamento", pl:"Polish", ps:"Pashto", pt:"Portuguese",
    qu:"Quechua", ro:"Romanian", ru:"Russian", rw:"Kinyarwanda", sa:"Sanskrit", sd:"Sindhi",
    si:"Sinhala", sk:"Slovak", sl:"Slovenian", sm:"Samoan", sn:"Shona", so:"Somali", sq:"Albanian",
    sr:"Serbian", st:"Sesotho", su:"Sundanese", sv:"Swedish", sw:"Swahili", ta:"Tamil", te:"Telugu",
    tg:"Tajik", th:"Thai", ti:"Tigrinya", tk:"Turkmen", tl:"Tagalog", tr:"Turkish", ts:"Tsonga",
    tt:"Tatar", ug:"Uyghur", uk:"Ukrainian", ur:"Urdu", uz:"Uzbek", vi:"Vietnamese", xh:"Xhosa",
    yi:"Yiddish", yo:"Yoruba", zh:"Chinese (Simplified)", "zh-TW":"Chinese (Traditional)", zu:"Zulu"
  };

  // 🏳️ Flag helper
  function getFlagEmoji(code) {
    if (!code) return "🌐";
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt()));
  }

  // Build dropdown list
  const ul = document.createElement("ul");
  ul.style.cssText = "list-style:none;padding:0;margin:0;";
  dropdown.appendChild(ul);

  Object.entries(languages).forEach(([code, name]) => {
    const li = document.createElement("li");
    li.innerHTML = `${getFlagEmoji(code.slice(0,2))} ${name} <small>(${code.toUpperCase()})</small>`;
    li.style.cssText = "padding:6px 10px;border-radius:6px;cursor:pointer;font-size:13px;";
    li.addEventListener("mouseover",()=>li.style.background="#ffe6ef");
    li.addEventListener("mouseout",()=>li.style.background="transparent");
    li.addEventListener("click",()=>{
      dropdown.style.display="none";
      indicator.textContent=`${getFlagEmoji(code.slice(0,2))} ${name}`;
      translatePage(code);
    });
    ul.appendChild(li);
  });

  search.addEventListener("input", e=>{
    const q=e.target.value.toLowerCase();
    ul.querySelectorAll("li").forEach(li=>{
      li.style.display=li.textContent.toLowerCase().includes(q)?"block":"none";
    });
  });

  indicator.addEventListener("click", e=>{
    e.stopPropagation();
    dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
  });
  document.addEventListener("click", e=>{
    if(!dropdown.contains(e.target)&&!indicator.contains(e.target)) dropdown.style.display="none";
  });

  // 🌍 Auto-translate for foreign visitors
  if(userLang!=="en" && country!=="India") translatePage(userLang);

  // 🔁 Auto recheck (every 15s)
  setInterval(async()=>{
    try{
      const res=await fetch(`/api/lang?nocache=${Date.now()}`,{headers:{"Cache-Control":"no-cache"}});
      const data=await res.json();
      if(data.detectedLang && data.detectedLang!==userLang){
        userLang=data.detectedLang;
        indicator.textContent=`${data.flag||"🌐"} ${userLang.toUpperCase()} ▼`;
        translatePage(userLang);
      }
    }catch(err){console.warn("VPN recheck failed:",err);}
  },15000);

  // 🔤 Translate visible text
  async function translatePage(targetLang){
    console.log("🔁 Translating page to:",targetLang);
    refreshBtn.classList.add("pulse-anim");
    indicator.classList.add("pulse-anim");
    const els=document.querySelectorAll("h1,h2,h3,p,a,button,span,li,label,option");
    for(const el of els){
      const text=el.textContent.trim();
      if(text.length>1){
        try{
          const res=await fetch(`/api/lang?text=${encodeURIComponent(text)}&target=${targetLang}&nocache=${Date.now()}`,{
            headers:{"Cache-Control":"no-cache"}
          });
          const data=await res.json();
          if(data.translated) el.textContent=data.translated;
        }catch{console.warn("Translation failed for:",text);}
      }
    }
    refreshBtn.classList.remove("pulse-anim");
    indicator.classList.remove("pulse-anim");
  }

  // 🔁 Manual Refresh
  refreshBtn.addEventListener("click", async ()=>{
    refreshBtn.classList.add("pulse-anim");
    indicator.classList.add("pulse-anim");
    await detectLanguage();
    await translatePage(userLang);
    refreshBtn.classList.remove("pulse-anim");
    indicator.classList.remove("pulse-anim");
  });
})();