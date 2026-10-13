import { readdir, readFile, writeFile } from 'node:fs/promises';
import { observabilityIssueSchema } from '../src/lib/observabilitySchema.js';
import { latestIssueFeeds } from '../src/lib/latestIssueFeeds.js';

const directory = new URL('../src/data/ai-observability/', import.meta.url);
const names = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
if (!names.length) throw new Error('No AI observability issues to publish');
const editions = [];
for (const name of names) {
  const edition = observabilityIssueSchema.parse(JSON.parse(await readFile(new URL(name, directory), 'utf8')));
  if (`${edition.date}.json` !== name) throw new Error(`Edition filename and date disagree: ${name}`);
  editions.push(edition);
}
const latest = editions.sort((a, b) => a.date.localeCompare(b.date)).at(-1);
const feeds = latestIssueFeeds(latest);
await writeFile(new URL('../public/md', import.meta.url), feeds.markdown);
await writeFile(new URL('../public/json', import.meta.url), feeds.json);
console.log(`Published AI observability feeds: ${latest.date}, ${latest.stories.length} stories`);
