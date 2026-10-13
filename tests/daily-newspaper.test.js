import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, copyFile, symlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { editionDates, validateDailyDraft, validateStoryImages, assertNoDuplicateStories } from '../scripts/lib/daily-newspaper.js';

const dates = editionDates(new Date('2026-10-13T02:30:00Z'));
const story = {
  title: 'Verified agent tracing release', url: 'https://example.com/trace/v1', publisher: 'Primary source', published: '2026-10-12', source: 'github', category_key: 'agents',
  summary: 'A verified release.', body: [Array(150).fill('context').join(' ')], takeaway: 'Check trace delivery.', dedupe_key: 'release:example/trace:v1',
  image: '/edition-images/2026-10-13/trace-v1.png',
  source_evidence: { url: 'https://example.com/trace/v1', publication_date: '2026-10-12', raw_date: '2026-10-12T12:00:00Z', method: 'Official stable release timestamp' },
  image_provenance: { kind: 'generated-editorial', generator: 'built-in-imagegen', prompt: 'Trace delivery infographic', based_on: ['https://example.com/trace/v1'], reviewed: true, sha256: 'a'.repeat(64) },
};
const issue = { date: '2026-10-13', story_window: '2026-10-12', dek: 'Verified issue.', research: { status: 'complete', completed_sources: ['hn', 'news', 'github'], checked_urls: ['https://example.com/blog'] }, stories: [story] };

test('dates are frozen to the chosen calendar zone and explicit edition override', () => {
  assert.equal(dates.storyWindow, '2026-10-12');
  assert.equal(editionDates(new Date('2026-10-12T20:00:00Z')).date, '2026-10-13');
  assert.equal(editionDates(new Date(), 'Asia/Kolkata', '2026-10-13').storyWindow, '2026-10-12');
  assert.throws(() => editionDates(new Date(), 'Asia/Kolkata', '2026-02-30'), /Invalid/);
});

test('daily contract blocks relabelled dates, incomplete research, thin text and every missing brief image', () => {
  assert.equal(validateDailyDraft(issue, dates).stories.length, 1);
  assert.throws(() => validateDailyDraft({ ...issue, stories: [{ ...story, source_evidence: { ...story.source_evidence, raw_date: '2026-10-30' } }] }, dates), /outside the window/);
  assert.throws(() => validateDailyDraft({ ...issue, research: { ...issue.research, completed_sources: ['news'] }, stories: [] }, dates), /three source/);
  assert.throws(() => validateDailyDraft({ ...issue, stories: [{ ...story, body: ['Too short.'] }] }, dates), /130 body words/);
  const brief = { ...story, format: 'brief', body: [Array(70).fill('detail').join(' ')], brief_reason: 'A narrow patch with limited release notes.' };
  assert.equal(validateDailyDraft({ ...issue, stories: [brief] }, dates).stories[0].format, 'brief');
  assert.throws(() => validateDailyDraft({ ...issue, stories: [{ ...brief, image: undefined }] }, dates), /Every story/);
  assert.throws(() => validateDailyDraft({ ...issue, stories: [{ ...story, image_provenance: undefined }] }, dates), /provenance/);
  assert.equal(validateDailyDraft({ ...issue, stories: [] }, dates).stories.length, 0);
});

test('deduplication catches same-day URL variants and historic cross-posts with rewritten titles', () => {
  assert.throws(() => assertNoDuplicateStories({ ...issue, stories: [story, { ...story, title: 'Other headline', dedupe_key: 'other', url: story.url + '/?utm_source=hn#read' }] }), /Duplicate/);
  const previous = { date: '2026-10-12', stories: [{ ...story, title: 'Earlier headline', url: 'https://other.example/blog', source_evidence: undefined }] };
  assert.throws(() => assertNoDuplicateStories(issue, [previous]), /Duplicate/);
  assert.doesNotThrow(() => assertNoDuplicateStories({ ...issue, stories: [{ ...story, title: 'Version two', url: 'https://example.com/trace/v2', source_evidence: undefined, dedupe_key: 'release:example/trace:v2' }] }, [previous]));
});

// Synthetic PNG is a test fixture, never a publication image.
function png() {
  const chunk = (type, bytes) => {
    const body = Buffer.concat([Buffer.from(type), bytes]);
    let crc = 0xffffffff;
    for (const byte of body) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    const length = Buffer.alloc(4); length.writeUInt32BE(bytes.length);
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, body, checksum]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(512); header.writeUInt32BE(512, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.alloc((512 * 4 + 1) * 512))), chunk('IEND', Buffer.alloc(0))]);
}

test('actual assets must exist, match review hashes, and be distinct complete PNGs', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'newspaper-images-'));
  try {
    const image = png();
    const illustrated = { ...story, image_provenance: { ...story.image_provenance, sha256: createHash('sha256').update(image).digest('hex') } };
    await assert.rejects(validateStoryImages({ ...issue, stories: [illustrated] }, directory), /ENOENT/);
    await writeFile(path.join(directory, 'trace-v1.png'), image);
    assert.equal((await validateStoryImages({ ...issue, stories: [illustrated] }, directory)).length, 1);
    await assert.rejects(validateStoryImages(issue, directory), /changed after/);
    await writeFile(path.join(directory, 'second.png'), image);
    await assert.rejects(validateStoryImages({ ...issue, stories: [illustrated, { ...illustrated, image: '/edition-images/2026-10-13/second.png' }] }, directory), /distinct/);
    await writeFile(path.join(directory, 'trace-v1.png'), image.subarray(0, 24));
    await assert.rejects(validateStoryImages({ ...issue, stories: [illustrated] }, directory), /Truncated|Incomplete|Expected/);
    assert.deepEqual(await validateStoryImages({ ...issue, stories: [] }, '/nonexistent'), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('runner promotes images, rolls back build failure, and safely retries publication after a commit', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'newspaper-runner-'));
  try {
    for (const folder of ['scripts/lib', 'src/lib', 'src/data/ai-observability', 'public', 'automation', 'skills/ai-observability-newspaper']) await mkdir(path.join(root, folder), { recursive: true });
    for (const name of ['scripts/run-daily-newspaper.js', 'scripts/lib/daily-newspaper.js', 'src/lib/observabilitySchema.js']) await copyFile(new URL('../' + name, import.meta.url), path.join(root, name));
    await symlink(new URL('../node_modules', import.meta.url).pathname, path.join(root, 'node_modules'));
    const image = png();
    const ready = { ...issue, stories: [{ ...story, image_provenance: { ...story.image_provenance, sha256: createHash('sha256').update(image).digest('hex') } }] };
    await writeFile(path.join(root, 'fixture.json'), JSON.stringify(ready));
    await writeFile(path.join(root, 'fixture.png'), image);
    await writeFile(path.join(root, '.gitignore'), '.cache/\nnode_modules/\n');
    await writeFile(path.join(root, 'noop.js'), 'process.exit(0);');
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ type: 'module', scripts: { 'fetch:sources': 'node noop.js', test: 'node noop.js', check: 'node noop.js', build: 'node build.js' } }));
    await writeFile(path.join(root, 'build.js'), "import {writeFileSync} from 'node:fs'; if(process.env.FAIL_BUILD) process.exit(1); writeFileSync('public/md','new export'); writeFileSync('public/json','new json');");
    await writeFile(path.join(root, 'agent.js'), "import {copyFileSync,mkdirSync} from 'node:fs';if(process.env.EMPTY_AGENT)process.exit(0);mkdirSync(process.argv[2]+'/images',{recursive:true});copyFileSync('fixture.json',process.argv[2]+'/draft.json');copyFileSync('fixture.png',process.argv[2]+'/images/trace-v1.png');");
    await writeFile(path.join(root, 'publisher.js'), "import {writeFileSync} from 'node:fs';if(process.env.FAIL_PUBLISH)process.exit(2);writeFileSync('.cache/published','yes');");
    await writeFile(path.join(root, 'automation/daily-newspaper.json'), JSON.stringify({ time_zone: 'Asia/Kolkata', mode: 'build', timeout_minutes: 1, agent: { command: [process.execPath, 'agent.js', '{run_dir}'] }, publish: { command: [process.execPath, 'publisher.js'], commit_edition: true } }));
    await writeFile(path.join(root, 'public/md'), 'old export'); await writeFile(path.join(root, 'public/json'), 'old json');
    execFileSync('git', ['init', '-q'], { cwd: root });
    const run = (env = {}, mode = 'build') => execFileSync(process.execPath, ['scripts/run-daily-newspaper.js', '--news-date', '2026-10-12', '--mode', mode], { cwd: root, env: { ...process.env, ...env }, stdio: 'pipe' });
    assert.throws(() => run({ FAIL_BUILD: '1' }));
    await assert.rejects(readFile(path.join(root, 'src/data/ai-observability/2026-10-13.json')), /ENOENT/);
    await assert.rejects(readFile(path.join(root, 'public/edition-images/2026-10-13/trace-v1.png')), /ENOENT/);
    assert.equal(await readFile(path.join(root, 'public/md'), 'utf8'), 'old export');
    // Even a zero exit with no new draft cannot reuse outputs from the failed attempt.
    assert.throws(() => run({ EMPTY_AGENT: '1' }));
    await assert.rejects(readFile(path.join(root, 'src/data/ai-observability/2026-10-13.json')), /ENOENT/);
    const result = JSON.parse(run().toString());
    assert.equal(result.stage, 'built'); assert.equal(result.published, false);
    const before = await readFile(path.join(root, 'src/data/ai-observability/2026-10-13.json'));
    assert.equal(JSON.parse(run().toString()).reused_existing_issue, true);
    assert.deepEqual(await readFile(path.join(root, 'src/data/ai-observability/2026-10-13.json')), before);
    assert.deepEqual(await readFile(path.join(root, 'public/edition-images/2026-10-13/trace-v1.png')), image);
    // Start a clean dedicated checkout and exercise the configured publish path with a stub.
    await rm(path.join(root, 'src/data/ai-observability/2026-10-13.json'));
    await rm(path.join(root, 'public/edition-images'), { recursive: true });
    await writeFile(path.join(root, 'public/md'), 'old export'); await writeFile(path.join(root, 'public/json'), 'old json');
    execFileSync('git', ['config', 'user.name', 'Runner test'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'runner@example.invalid'], { cwd: root });
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'Fixture baseline'], { cwd: root });
    assert.throws(() => run({ FAIL_PUBLISH: '1' }, 'publish'));
    assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(), '');
    assert.deepEqual(await readFile(path.join(root, 'src/data/ai-observability/2026-10-13.json')), before);
    const published = JSON.parse(run({}, 'publish').toString());
    assert.equal(published.published, true); assert.equal(published.reused_existing_issue, true);
    assert.equal(await readFile(path.join(root, '.cache/published'), 'utf8'), 'yes');
  } finally { await rm(root, { recursive: true, force: true }); }
});
