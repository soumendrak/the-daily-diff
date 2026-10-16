// Capture the one-use browser event before deferred component scripts run.
window.__tidyTracesPWA = { prompt: null, installed: false };
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  window.__tidyTracesPWA.prompt = event;
  window.dispatchEvent(new Event('tidytraces:install-ready'));
});
window.addEventListener('appinstalled', () => {
  window.__tidyTracesPWA.installed = true;
  window.__tidyTracesPWA.prompt = null;
});
