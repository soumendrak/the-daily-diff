import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'publish';
if (!['build', 'publish'].includes(mode)) throw new Error('Mode must be build or publish');
const begin = '# BEGIN TIDYTRACES DAILY NEWSPAPER';
const end = '# END TIDYTRACES DAILY NEWSPAPER';
const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
const cronPath = `${path.dirname(process.execPath)}:/opt/homebrew/bin:/usr/local/bin:${process.env.HOME}/Library/pnpm:${process.env.HOME}/.local/bin:/usr/bin:/bin`;
const command = `cd ${quote(repo)} && mkdir -p .cache && PATH=${quote(cronPath)} ${quote(process.execPath)} ${quote(path.join(repo, 'scripts/run-daily-newspaper.js'))} --mode ${mode} >> ${quote(path.join(repo, '.cache/newspaper-cron.log'))} 2>&1`;
if (/[\r\n]/.test(command)) throw new Error('Cron paths cannot contain newlines');
const block = `${begin}\n# 08:00 HOST LOCAL TIME; configure host time zone accordingly\n0 8 * * * ${command.replaceAll('%', '\\%')}\n${end}`;
if (args.includes('--print')) { console.log(block); process.exit(0); }
if (!args.includes('--install') && !args.includes('--remove')) throw new Error('Use --print, --install, or --remove');
let current = '';
try { current = execFileSync('crontab', ['-l'], { encoding: 'utf8' }); } catch (error) {
  if (!String(error.stderr).includes('no crontab')) throw error;
}
const managed = new RegExp(`${begin}[\\s\\S]*?${end}\\n?`, 'g');
const retained = current.replace(managed, '').trimEnd();
const next = args.includes('--remove') ? retained : `${retained}${retained ? '\n\n' : ''}${block}`;
execFileSync('crontab', ['-'], { input: next + '\n' });
console.log(args.includes('--remove') ? 'Removed the managed newspaper job; unrelated entries preserved.' : 'Installed the managed newspaper job at 08:00 host local time.');
