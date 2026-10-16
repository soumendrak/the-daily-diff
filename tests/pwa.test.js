import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import sharp from 'sharp';
import { setupPWAInstall } from '../src/lib/pwaInstall.js';

const bootstrap = await readFile(new URL('../src/scripts/pwa-prompt.js', import.meta.url), 'utf8');
class Element extends EventTarget {
  hidden = false;
  disabled = false;
  textContent = '';
  attributes = {};
  classList = { add() {}, remove() {} };
  setAttribute(name, value) { this.attributes[name] = value; }
}
function browser({ ua = 'Android Chrome', standalone = false } = {}) {
  const elements = Object.fromEntries(['banner', 'btn', 'close-btn', 'desc-text'].map(key =>
    [key === 'banner' ? 'pwa-install-banner' : key === 'btn' ? 'pwa-install-btn' : `pwa-${key}`, new Element()]));
  elements['pwa-install-banner'].hidden = true;
  const win = new EventTarget();
  const timers = new Map();
  const mode = Object.assign(new EventTarget(), { matches: standalone });
  Object.assign(win, {
    document: { getElementById: id => elements[id] },
    navigator: { userAgent: ua, platform: '', maxTouchPoints: 0 },
    matchMedia: () => mode,
    setTimeout: fn => { const id = timers.size + 1; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
  });
  vm.runInNewContext(bootstrap, { window: win, Event });
  const controls = { win, elements, mode, timers, start: () => setupPWAInstall(win) };
  return Object.assign(controls, {
    banner: elements['pwa-install-banner'],
    install: elements['pwa-install-btn'],
    close: elements['pwa-close-btn'],
    description: elements['pwa-desc-text'],
  });
}
function offer(win, { outcome = 'accepted', fail = false, choice } = {}) {
  let calls = 0;
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = async () => { calls++; if (fail) throw new Error('Prompt unavailable'); };
  event.userChoice = choice || Promise.resolve({ outcome });
  win.dispatchEvent(event);
  return { event, calls: () => calls };
}
const click = async element => {
  element.dispatchEvent(new Event('click'));
  await new Promise(resolve => setImmediate(resolve));
};

test('an early browser event is cancelled, retained, and invoked once by Install', async () => {
  const b = browser();
  const p = offer(b.win);
  assert.equal(p.event.defaultPrevented, true);
  b.start();
  assert.equal(b.banner.hidden, false);
  await click(b.install);
  assert.equal(p.calls(), 1);
  assert.equal(b.banner.hidden, true);
  assert.equal(b.win.__tidyTracesPWA.prompt, null);
});

test('double taps cannot reuse the single-use event and appinstalled hides pending UI', async () => {
  const b = browser(); b.start();
  let finish;
  const p = offer(b.win, { choice: new Promise(resolve => { finish = resolve; }) });
  await click(b.install);
  assert.equal(b.install.disabled, true);
  await click(b.install);
  assert.equal(p.calls(), 1);
  b.win.dispatchEvent(new Event('appinstalled'));
  assert.equal(b.banner.hidden, true);
  finish({ outcome: 'accepted' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(b.banner.hidden, true);
});

test('a dismissed or failed prompt gives visible recovery and accepts a fresh event', async () => {
  for (const options of [{ outcome: 'dismissed' }, { fail: true }]) {
    const b = browser(); b.start(); offer(b.win, options);
    await click(b.install);
    assert.equal(b.banner.hidden, false);
    assert.equal(b.install.hidden, true);
    assert.match(b.description.textContent, /browser menu.*Install app/);
    const fresh = offer(b.win);
    assert.equal(b.install.hidden, false);
    await click(b.install);
    assert.equal(fresh.calls(), 1);
  }
});

test('Android and iOS without a native prompt get an actionable help button', async () => {
  for (const [ua, instruction] of [['Android Chrome', /browser menu/], ['iPhone Safari', /Share, then Add to Home Screen/], ['Android; wv) Instagram', /Open tidytraces.com in Chrome or Safari/]]) {
    const b = browser({ ua }); b.start();
    for (const timer of b.timers.values()) timer();
    assert.equal(b.install.textContent, 'How to install');
    await click(b.install);
    assert.match(b.description.textContent, instruction);
    assert.equal(b.banner.hidden, false);
    assert.equal(b.install.hidden, true);
  }
});

test('a stale event cannot leave an inert Install button', async () => {
  const b = browser(); b.start(); offer(b.win);
  b.win.__tidyTracesPWA.prompt = null;
  await click(b.install);
  assert.match(b.description.textContent, /Add to Home screen/);
  assert.equal(b.install.hidden, true);
});

test('a browser that never resolves its native prompt still gets recovery instructions', async () => {
  const b = browser(); b.start();
  offer(b.win, { choice: new Promise(() => {}) });
  await click(b.install);
  for (const timer of b.timers.values()) timer();
  assert.equal(b.install.hidden, true);
  assert.match(b.description.textContent, /If no install prompt appeared.*browser menu/);
  assert.equal(b.banner.hidden, false);
});

test('installed and standalone apps suppress the banner and fallback timer', () => {
  for (const earlyInstalled of [false, true]) {
    const b = browser({ standalone: !earlyInstalled });
    if (earlyInstalled) b.win.dispatchEvent(new Event('appinstalled'));
    b.start();
    assert.equal(b.banner.hidden, true);
    assert.equal(b.timers.size, 0);
  }
  const b = browser(); b.start();
  b.close.dispatchEvent(new Event('click'));
  assert.equal(b.timers.size, 0);
});

test('both manifest entry points have identical identity and decodable app icons', async () => {
  const dir = new URL('../public/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', dir), 'utf8'));
  assert.deepEqual(manifest, JSON.parse(await readFile(new URL('manifest.json', dir), 'utf8')));
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const data = await readFile(new URL(icon.src.slice(1), dir));
    const { width, height } = await sharp(data).metadata();
    assert.equal(`${width}x${height}`, icon.sizes);
  }
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
  const canonical = await sharp(await readFile(new URL('brand/tidytraces-icon-512.png', dir))).raw().toBuffer();
  const legacy = await sharp(await readFile(new URL('icon.png', dir))).raw().toBuffer();
  assert.deepEqual(legacy, canonical, 'the fallback icon must use the actual Tidy Traces mark');
});
