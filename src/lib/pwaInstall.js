export function setupPWAInstall(win) {
  const doc = win.document;
  const banner = doc.getElementById('pwa-install-banner');
  const install = doc.getElementById('pwa-install-btn');
  const close = doc.getElementById('pwa-close-btn');
  const description = doc.getElementById('pwa-desc-text');
  if (!banner || !install || !close || !description) return;

  const state = win.__tidyTracesPWA;
  const displayMode = win.matchMedia('(display-mode: standalone)');
  const ua = win.navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) ||
    (win.navigator.platform === 'MacIntel' && win.navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const embedded = /FBAN|FBAV|Instagram|Twitter|Slack|GSA|Line\/|; wv\)/i.test(ua);
  let opening = false;
  let fallbackTimer;

  const installed = () => state.installed || displayMode.matches || win.navigator.standalone === true;
  const hide = () => {
    win.clearTimeout(fallbackTimer);
    banner.classList.remove('is-visible');
    banner.hidden = true;
    banner.setAttribute('aria-hidden', 'true');
  };
  const show = () => {
    if (installed()) return;
    banner.hidden = false;
    banner.setAttribute('aria-hidden', 'false');
    banner.classList.add('is-visible');
  };
  const instructions = () => {
    if (embedded) return 'Open tidytraces.com in Chrome or Safari, then use the browser menu to install.';
    if (ios) return 'Tap Share, then Add to Home Screen. If needed, scroll down in the Share menu.';
    if (android) return 'Open your browser menu (⋮) and choose Install app or Add to Home screen. If neither appears, open tidytraces.com in Chrome.';
    return 'Open your browser menu and choose Install Tidy Traces or Install app, if available.';
  };
  const showHelp = (prefix = '') => {
    win.clearTimeout(fallbackTimer);
    description.textContent = prefix + instructions();
    install.hidden = true;
    show();
  };
  const ready = () => {
    win.clearTimeout(fallbackTimer);
    if (installed() || opening || !state.prompt) return;
    description.textContent = 'Install for quick access to daily editions.';
    install.hidden = false;
    install.disabled = false;
    install.textContent = 'Install';
    show();
  };

  win.addEventListener('tidytraces:install-ready', ready);
  win.addEventListener('appinstalled', hide);
  displayMode.addEventListener('change', () => { if (installed()) hide(); });
  close.addEventListener('click', hide);
  install.addEventListener('click', async () => {
    if (installed()) { hide(); return; }
    if (opening) return;
    const prompt = state.prompt;
    state.prompt = null;
    if (!prompt) { showHelp(); return; }
    opening = true;
    install.disabled = true;
    install.textContent = 'Opening…';
    description.textContent = 'Complete installation in your browser’s prompt.';
    // Some browser shells expose the event but never display native install UI.
    fallbackTimer = win.setTimeout(() => {
      if (!installed()) showHelp('If no install prompt appeared, ');
    }, 8000);
    try {
      // Call while the click still has user activation. The event is single-use.
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted' || installed()) hide();
      else showHelp('Installation dismissed. ');
    } catch {
      if (!installed()) showHelp('The install prompt could not open. ');
    } finally {
      win.clearTimeout(fallbackTimer);
      opening = false;
      install.disabled = false;
      install.textContent = 'Install';
      if (state.prompt && !installed()) ready();
    }
  });

  if (installed()) hide();
  else if (state.prompt) ready();
  else if (ios || android) {
    // Browsers may withhold the native prompt. Offer a clearly named help action.
    fallbackTimer = win.setTimeout(() => {
      if (state.prompt) { ready(); return; }
      install.textContent = 'How to install';
      install.hidden = false;
      show();
    }, 2000);
  }
}
