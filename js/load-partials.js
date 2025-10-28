// js/load-partials.js
document.addEventListener("DOMContentLoaded", () => {
  // Automatically detect correct base path
  const basePath = window.location.pathname.includes("/modules/")
    ? "../partials/"
    : "partials/";

  // Load Header
  fetch(basePath + "header.html")
    .then(res => res.text())
    .then(html => {
      const header = document.getElementById("header");
      if (header) header.innerHTML = html;
    });

  // Load Footer
  fetch(basePath + "footer.html")
    .then(res => res.text())
    .then(html => {
      const footer = document.getElementById("footer");
      if (footer) footer.innerHTML = html;
    });
});