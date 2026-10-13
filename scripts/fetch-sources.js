import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { hnCandidate, githubReleaseCandidate } from '../src/lib/sourceCandidates.js';
import { z } from 'astro/zod';

const argument = process.argv.indexOf('--date');
const yesterday = new Date(); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
const day = z.iso.date().parse(argument >= 0 ? process.argv[argument + 1] : yesterday.toISOString().slice(0, 10));
const config = JSON.parse(await readFile(new URL('../src/data/source-config.json', import.meta.url), 'utf8'));
const start = Date.parse(`${day}T00:00:00Z`) / 1000;
const end = start + 86400;

async function request(url) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (url.startsWith('https://api.github.com/') && !token) {
    // Reuse a local gh login without printing or passing its token as a command argument.
    try { return JSON.parse(execFileSync('gh', ['api', url.slice('https://api.github.com/'.length)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
    catch { /* Public API requests can also run without gh authentication. */ }
  }
  const headers = { 'User-Agent': 'tidy-traces-source-fetcher', ...(url.startsWith('https://api.github.com/') ? { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } : {}) };
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
    if (response.ok) return response.json();
    if (response.status >= 500 && attempt < 2) continue;
    throw new Error(`Source request failed (${response.status}): ${new URL(url).hostname}`);
  }
}

const ids = new Set();
for (const query of config.hn_queries) {
  let pages = 1;
  for (let page = 0; page < pages; page++) {
    const parameters = new URLSearchParams({ query, tags: 'story', numericFilters: `created_at_i>=${start},created_at_i<${end}`, hitsPerPage: '100', page: String(page) });
    const result = await request(`https://hn.algolia.com/api/v1/search_by_date?${parameters}`);
    if (result.nbPages > 10) throw new Error(`HN query exceeds the configured review limit: ${query}`);
    pages = result.nbPages;
    result.hits.forEach((hit) => ids.add(hit.objectID));
  }
}
const hn = [];
for (const id of ids) {
  const candidate = hnCandidate(await request(`https://hacker-news.firebaseio.com/v0/item/${id}.json`), day);
  if (candidate) hn.push(candidate);
}
const github = [];
const checks = [];
for (const repo of config.github_repositories) {
  const releases = await request(`https://api.github.com/repos/${repo}/releases?per_page=100`);
  if (!Array.isArray(releases)) throw new Error(`Invalid GitHub response for ${repo}`);
  checks.push({ repository: repo, releases_checked: releases.length, coverage: 'latest 100 releases; not a global GitHub search' });
  for (const release of releases) {
    const candidate = githubReleaseCandidate(repo, release, day);
    if (candidate) github.push(candidate);
  }
}
const output = { date: day, fetched_at: new Date().toISOString(), scope: 'AI observability discovery candidates; not automatically published stories', hn_queries: config.hn_queries, github_checks: checks, candidates: [...hn, ...github] };
const directory = new URL('../.cache/source-candidates/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL(`${day}.json`, directory), JSON.stringify(output, null, 2) + '\n');
console.log(`Fetched ${hn.length} HN candidates and ${github.length} GitHub release candidates for ${day}. Review .cache/source-candidates/${day}.json before publishing.`);
