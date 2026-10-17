// Production must only ever serve what master builds. Ad-hoc deploys from an
// uncommitted or unmerged tree were silently reverted by the next clean daily
// deploy (the Pages project also deploys every push to master).
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const fail = (message) => { console.error(`Refusing to deploy: ${message}`); process.exit(1); };

if (git('status', '--porcelain')) fail('the working tree has uncommitted changes. Commit them and merge to master first, or the next daily deploy reverts them.');
try { git('merge-base', '--is-ancestor', 'HEAD', 'origin/master'); } catch { fail('HEAD is not on origin/master. Open a PR and merge it; production deploys come from master.'); }
