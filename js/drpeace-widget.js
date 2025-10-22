// 🔹 DR PEACE AI WIDGET — Universal Global Assistant
import { auth, database } from "/js/firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

(function () {
  // 🧠 User data placeholder
  let userData = { name: "Guest", role: "visitor", email: null };

  // ✅ Detect user from Firebase
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const snap = await get(ref(database, "users/" + user.uid));
      const data = snap.val();
      userData = {
        name: data?.name || user.displayName || "User",
        role: data?.role || "patient",
        email: user.email || data?.email
      };
    }
  });

  // 💬 Widget HTML
  const widgetHTML = `
    <div id="drpeace-root">
      <button id="dp-toggle" aria-label="Chat with Dr Peace">🩺</button>
      <div id="dp-panel" aria-hidden="true">
        <header>
          <div class="dp-title">DR PEACE AI</div>
          <button id="dp-close">✕</button>
        </header>
        <div id="dp-messages" role="log" aria-live="polite"></div>
        <form id="dp-form">
          <input id="dp-input" placeholder="Ask Dr Peace..." autocomplete="off" />
          <button id="dp-send" type="submit">Send</button>
        </form>
      </div>
    </div>
  `;

  // 🎨 Widget CSS
  const widgetCSS = `
    #drpeace-root { position: fixed; right: 25px; bottom: 25px; z-index: 3000; font-family: Arial, sans-serif; }
    #dp-toggle { background: #c71585; color: #fff; border-radius: 50%; width: 60px; height: 60px; border: none; font-size: 24px; cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,0.3); }
    #dp-toggle:hover { transform: scale(1.1); transition: 0.2s; }
    #dp-panel { display: none; flex-direction: column; position: fixed; right: 25px; bottom: 100px; width: 340px; max-height: 70vh; background: #fff; border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.25); overflow: hidden; }
    #dp-panel header { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: linear-gradient(90deg, #f8d9ec, #dce9ff); }
    .dp-title { font-weight: 700; color: #c71585; }
    #dp-close { background: none; border: none; font-size: 16px; cursor: pointer; color: #555; }
    #dp-messages { padding: 12px; overflow-y: auto; flex: 1; }
    .dp-msg { margin: 8px 0; display: flex; }
    .dp-user { justify-content: flex-end; }
    .dp-user .dp-text { background: #c71585; color: #fff; border-radius: 18px 18px 4px 18px; padding: 10px 12px; max-width: 78%; }
    .dp-bot .dp-text { background: #f1f1f1; color: #222; border-radius: 18px 18px 18px 4px; padding: 10px 12px; max-width: 78%; }
    #dp-form { display: flex; gap: 8px; padding: 10px; border-top: 1px solid #eee; background: #fafafa; }
    #dp-input { flex: 1; padding: 10px; border-radius: 6px; border: 1px solid #ddd; }
    #dp-send { background: #c71585; color: #fff; border: none; padding: 10px 14px; border-radius: 6px; cursor: pointer; }
    .dp-action { background: #28a745; color: #fff; border: none; padding: 8px 10px; border-radius: 6px; margin-top: 6px; cursor: pointer; }
  `;

  const style = document.createElement("style");
  style.textContent = widgetCSS;
  document.head.appendChild(style);

  const container = document.createElement("div");
  container.innerHTML = widgetHTML;
  document.body.appendChild(container);

  const toggle = document.getElementById("dp-toggle");
  const panel = document.getElementById("dp-panel");
  const closeBtn = document.getElementById("dp-close");
  const messages = document.getElementById("dp-messages");
  const form = document.getElementById("dp-form");
  const input = document.getElementById("dp-input");

  toggle.addEventListener("click", () => {
    panel.style.display = "flex";
    input.focus();
  });
  closeBtn.addEventListener("click", () => {
    panel.style.display = "none";
  });

  function appendMessage(role, text) {
    const el = document.createElement("div");
    el.className = "dp-msg " + (role === "user" ? "dp-user" : "dp-bot");
    el.innerHTML = `<div class="dp-text">${text}</div>`;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  async function sendMessage(msg) {
    appendMessage("user", msg);
    const pending = document.createElement("div");
    pending.className = "dp-msg dp-bot";
    pending.innerHTML = `<div class="dp-text"><i>Dr Peace is thinking...</i></div>`;
    messages.appendChild(pending);

    let idToken = null;
    const user = auth.currentUser;
    if (user) {
      try { idToken = await user.getIdToken(); } catch (e) {}
    }

    const res = await fetch("/api/drpeace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: "Bearer " + idToken } : {})
      },
      body: JSON.stringify({
        message: msg,
        user: userData
      })
    });

    const data = await res.json();
    pending.remove();
    appendMessage("bot", data.reply || "Sorry, something went wrong.");

    if (data.actions?.bookUrl) {
      const btn = document.createElement("button");
      btn.className = "dp-action";
      btn.textContent = "📅 Book Consultation";
      btn.onclick = () => window.location.href = data.actions.bookUrl;
      messages.appendChild(btn);
    }
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg) return;
    input.value = "";
    sendMessage(msg);
  });

  // 🎯 Personalized Greeting
  setTimeout(() => {
    appendMessage("bot", `👋 Hi ${userData.name}! I’m <b>Dr Peace</b>.<br>How can I assist you today?`);
  }, 1500);
})();