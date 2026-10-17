import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { auditEditionHtml } from '../scripts/lib/edition-html-audit.js';
import { EDITION_AUTHOR, AI_IMAGE_DISCLOSURE, imageCaptionFor } from '../src/lib/editionCredits.js';
import { latestIssueFeeds } from '../src/lib/latestIssueFeeds.js';

// Regression guard: the byline and the hidden, edition-level AI disclosure were twice
// deployed from an uncommitted tree and then silently reverted by the next clean daily
// deploy. Rendering the real template here means any reversion fails `npm test`.

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generated = { kind: 'generated-editorial', generator: 'built-in-imagegen', prompt: 'Trace flow', based_on: ['https://example.com/a'], reviewed: true, sha256: 'a'.repeat(64) };
const page = ({ masthead = `<p class="edition-byline">By <a href="${EDITION_AUTHOR.url}">${EDITION_AUTHOR.name}</a></p>`, wrapper = '', disclosure = `<p id="ai-image-disclosure" class="visually-hidden ai-image-disclosure">${AI_IMAGE_DISCLOSURE}</p>` } = {}) =>
  `<html><head><meta name="description" content="AI-generated"></head><body><header class="masthead" data-astro-cid-x><h1>Tidy Traces</h1>${masthead}</header>` +
  `<article class="story is-lead has-image"><div class="story-image-wrapper is-loading" data-astro-cid-x><img src="/a.webp" data-image-provenance="generated-editorial" aria-describedby="ai-image-disclosure">${wrapper}</div>` +
  `<div class="story-body"><p>Teams audit AI-generated code paths.</p></div></article>${disclosure}</body></html>`;

test('edition audit accepts a top byline with one hidden edition-level AI disclosure', () => {
  assert.deepEqual(auditEditionHtml(page()), []);
});

test('edition audit rejects visible per-image AI captions and a missing or misplaced byline', () => {
  assert.match(auditEditionHtml(page({ wrapper: '<p class="image-caption">AI-generated editorial infographic · based on the linked source</p>' })).join('\n'), /per-image AI caption/);
  assert.match(auditEditionHtml(page({ wrapper: '<figcaption>AI generated</figcaption>' })).join('\n'), /per-image AI caption/);
  assert.match(auditEditionHtml(page({ masthead: '' })).join('\n'), /byline/);
  const late = page({ masthead: '' }).replace('</article>', `</article><p class="edition-byline">By ${EDITION_AUTHOR.name}</p>`);
  assert.match(auditEditionHtml(late).join('\n'), /byline/);
  assert.match(auditEditionHtml(page({ disclosure: '' })).join('\n'), /disclosure/);
  assert.match(auditEditionHtml(page({ disclosure: `<p class="ai-image-disclosure">${AI_IMAGE_DISCLOSURE}</p>` })).join('\n'), /visually hidden/);
  const twice = page().replace('</body>', `<p class="visually-hidden ai-image-disclosure">${AI_IMAGE_DISCLOSURE}</p></body>`);
  assert.match(auditEditionHtml(twice).join('\n'), /exactly one/);
});

test('generated graphics get no per-image caption; source images keep attribution', () => {
  assert.equal(imageCaptionFor({ image: '/a.webp', publisher: 'Langfuse', image_provenance: generated }), undefined);
  assert.equal(imageCaptionFor({ image: 'https://example.com/shot.png', publisher: 'Anthropic' }), 'Source image · Anthropic');
  assert.equal(imageCaptionFor({ publisher: 'Anthropic' }), undefined);
});

test('markdown export carries the byline up top and one AI disclosure at the end, not per image', () => {
  const story = { title: 'Trace flow', publisher: 'P', url: 'https://example.com/a', published: '2026-10-12', source: 'news', category_key: 'agents', summary: 'Claim.', takeaway: 'Context.', image: '/edition-images/2026-10-13/a.webp' };
  const edition = { date: '2026-10-13', story_window: '2026-10-12', dek: 'Dek.', stories: [{ ...story, image_provenance: generated }, { ...story, title: 'Second', url: 'https://example.com/b', image_provenance: generated }] };
  const { markdown } = latestIssueFeeds(edition);
  const lines = markdown.split('\n');
  assert.ok(lines.slice(0, 4).includes(`By ${EDITION_AUTHOR.name}`), 'byline near the top');
  assert.equal(markdown.split(AI_IMAGE_DISCLOSURE).length - 1, 1, 'exactly one disclosure');
  assert.ok(markdown.lastIndexOf(AI_IMAGE_DISCLOSURE) > markdown.lastIndexOf('## Second'), 'disclosure after the last story');
  assert.doesNotMatch(markdown.slice(0, markdown.lastIndexOf(AI_IMAGE_DISCLOSURE)), /AI[-\s]generated/i);
});

test('every built edition page has the top byline and no visible per-image AI caption', async () => {
  const { build } = await import('astro');
  const outDir = await mkdtemp(path.join(tmpdir(), 'tidytraces-build-'));
  try {
    await build({ root: repo, outDir, logLevel: 'error' });
    const days = (await readdir(path.join(outDir, 'ai-observability'), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    const sources = (await readdir(path.join(repo, 'src/data/ai-observability'))).filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5));
    assert.deepEqual(days.sort(), sources.sort(), 'every curated issue is rendered by the shared template');
    for (const file of ['index.html', ...days.map((day) => `ai-observability/${day}/index.html`)]) {
      assert.deepEqual(auditEditionHtml(await readFile(path.join(outDir, file), 'utf8')), [], file);
    }
    const css = await Promise.all((await readdir(path.join(outDir, '_astro'))).filter((name) => name.endsWith('.css')).map((name) => readFile(path.join(outDir, '_astro', name), 'utf8')));
    assert.match(css.join('\n'), /\.visually-hidden\{[^}]*clip:/, 'the disclosure class is visually hidden, not display:none');
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('ad-hoc deploys refuse uncommitted or unmerged site changes', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tidytraces-deploy-'));
  const git = (...args) => execFileSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: dir, stdio: 'pipe' });
  const guard = () => spawnSync(process.execPath, [path.join(repo, 'scripts/require-committed-site.js')], { cwd: dir, encoding: 'utf8' });
  try {
    git('init', '-q', '-b', 'master');
    await writeFile(path.join(dir, 'a.txt'), 'one');
    git('add', '.'); git('commit', '-qm', 'one'); git('update-ref', 'refs/remotes/origin/master', 'HEAD');
    assert.equal(guard().status, 0);
    await writeFile(path.join(dir, 'a.txt'), 'dirty');
    assert.match(guard().stderr, /uncommitted/);
    git('commit', '-qam', 'local only');
    assert.match(guard().stderr, /not on origin\/master/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
