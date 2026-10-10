// pwa.js – turns UNTANGLED into an installable app.
// 1) registers the service worker (offline support)
// 2) shows an "Install" box when the browser says the app can be installed
// 3) on iPhone, which has no install button, shows how to add it by hand

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => console.error("Service worker failed:", err));
  });
}

(() => {
  const box = document.getElementById("install-box");
  const text = document.getElementById("install-text");
  const installBtn = document.getElementById("install-btn");
  const laterBtn = document.getElementById("install-later");
  if (!box) return;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (isStandalone) return; // already running as an installed app

  let installEvent = null;

  // Android / Chrome / Edge: the browser hands us an install prompt to use.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEvent = e;
    text.textContent = "Install UNTANGLED on this phone for quick access, even without internet.";
    installBtn.hidden = false;
    box.hidden = false;
  });

  installBtn.addEventListener("click", async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    box.hidden = true;
  });

  window.addEventListener("appinstalled", () => (box.hidden = true));
  laterBtn.addEventListener("click", () => (box.hidden = true));

  // iPhone / iPad (Safari): no install prompt exists, so explain the manual way.
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    text.textContent = "To install: tap the Share button, then choose Add to Home Screen.";
    installBtn.hidden = true;
    box.hidden = false;
  }
})();
