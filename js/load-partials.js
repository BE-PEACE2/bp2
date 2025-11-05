document.addEventListener("DOMContentLoaded", () => {
  const basePath = window.location.pathname.includes("/modules/")
    ? "../partials/"
    : "partials/";

  fetch(basePath + "header.html")
    .then(res => res.text())
    .then(html => {
      const header = document.getElementById("header");
      if (header) {
        header.innerHTML = html;

       // ✅ Always load header-auth.js from root folder
const script = document.createElement("script");
script.type = "module";
script.src = "/js/header-auth.js?v=" + Date.now();  // cache-bust
script.onload = () => console.log("✅ header-auth.js LOADED");
script.onerror = (e) => console.error("❌ header-auth.js FAILED", e);
document.body.appendChild(script);
      }
    });

  fetch(basePath + "footer.html")
    .then(res => res.text())
    .then(html => {
      const footer = document.getElementById("footer");
      if (footer) footer.innerHTML = html;
    });
});