import sharp from 'sharp';
import { readdir, readFile, writeFile } from 'node:fs/promises';

// Keep old browser-discovered URLs branded too, including existing shortcuts.
const publicDir = new URL('../public/', import.meta.url);
const source = await readFile(new URL('brand/tidytraces-icon-512.png', publicDir));
for (const name of await readdir(publicDir)) {
  const sized = name.match(/^(?:(?:android|apple|ms)-icon|favicon)-(\d+)(?:x\d+)?\.png$/);
  const size = sized ? Number(sized[1]) :
    name === 'icon.png' ? 512 : /^(apple-icon|apple-icon-precomposed)\.png$/.test(name) ? 192 : null;
  if (size) await sharp(source).resize(size, size).png().toFile(new URL(name, publicDir).pathname);
}

// An opaque, padded canvas keeps the trace inside Android's maskable safe zone.
const [r, g, b] = await sharp(source).extract({ left: 256, top: 16, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
const inset = await sharp(source).resize(384, 384).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 3, background: { r, g, b } } })
  .composite([{ input: inset, left: 64, top: 64 }]).png()
  .toFile(new URL('brand/tidytraces-maskable-512.png', publicDir).pathname);

// ICO supports PNG payloads; retain common browser fallback sizes in one file.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(size => sharp(source).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((image, index) => {
  const entry = 6 + index * 16;
  header[entry] = header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile(new URL('favicon.ico', publicDir), Buffer.concat([header, ...images]));
