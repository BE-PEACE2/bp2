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

async function loadSlots() {
  try {
    const res = await fetch("/api/getSlots");
    const data = await res.json();

    const slotSelect = document.getElementById("slot");
    slotSelect.innerHTML = ""; // clear old

    if (!data.available || data.available.length === 0) {
      slotSelect.innerHTML = `<option>No slots available</option>`;
      slotSelect.disabled = true;
      return;
    }

    data.available.forEach(slot => {
      const opt = document.createElement("option");
      opt.value = slot;
      opt.textContent = slot;
      slotSelect.appendChild(opt);
    });
  } catch (err) {
    console.error("Failed to load slots:", err);
  }
}

window.addEventListener("DOMContentLoaded", loadSlots);