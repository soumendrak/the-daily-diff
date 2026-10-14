import { readFile, writeFile } from 'node:fs/promises';
import { optimizeNewspaperImage } from './lib/newspaper-images.js';

const [input, output, ...extra] = process.argv.slice(2);
if (!input || !output?.endsWith('.webp') || extra.length) throw new Error('Usage: node scripts/optimize-newspaper-image.js INPUT_IMAGE OUTPUT.webp');
const { data, ...metadata } = await optimizeNewspaperImage(await readFile(input));
// Protect existing reviewed images from accidental replacement.
await writeFile(output, data, { flag: 'wx' });
console.log(JSON.stringify({ image: output, bytes: data.length, ...metadata }, null, 2));
