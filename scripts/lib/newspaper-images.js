import sharp from 'sharp';
import { createHash } from 'node:crypto';

export const MAX_IMAGE_BYTES = 300_000;
export const MAX_IMAGE_WIDTH = 1440;
export const MIN_IMAGE_EDGE = 512;
const decodeOptions = { failOn: 'warning', limitInputPixels: 16_000_000 };

/** Compress an existing graphic; this never substitutes for built-in image generation. */
export async function optimizeNewspaperImage(input) {
  const metadata = await sharp(input, decodeOptions).metadata();
  if ((metadata.pages || 1) !== 1) throw new Error('Newspaper graphics must be static images');
  for (const quality of [82, 78, 74, 70]) {
    const { data, info } = await sharp(input, decodeOptions)
      .rotate()
      .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
      .webp({ quality, effort: 6, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });
    if (Math.min(info.width, info.height) < MIN_IMAGE_EDGE) throw new Error('Infographic shortest edge must remain at least 512 pixels');
    if (data.length <= MAX_IMAGE_BYTES) return {
      data,
      image_width: info.width,
      image_height: info.height,
      sha256: createHash('sha256').update(data).digest('hex'),
      optimization: { format: 'webp', quality, max_width: MAX_IMAGE_WIDTH, source_sha256: createHash('sha256').update(input).digest('hex') },
    };
  }
  throw new Error('Graphic exceeds 300 KB at readable quality; simplify or regenerate it before publication');
}

export async function validateNewspaperImage(data, filename, story) {
  if (!filename.endsWith('.webp') || data.length < 20 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP' || data.readUInt32LE(4) + 8 !== data.length) throw new Error(`Missing, truncated or invalid infographic WebP: ${filename}`);
  if (data.length > MAX_IMAGE_BYTES) throw new Error(`Infographic exceeds the 300 KB limit: ${filename}`);
  const metadata = await sharp(data, decodeOptions).metadata();
  if (metadata.format !== 'webp' || (metadata.pages || 1) !== 1 || Math.min(metadata.width, metadata.height) < MIN_IMAGE_EDGE || metadata.width > MAX_IMAGE_WIDTH) throw new Error(`Invalid infographic format or dimensions: ${filename}`);
  if ((story.image_width !== undefined && story.image_width !== metadata.width) || (story.image_height !== undefined && story.image_height !== metadata.height)) throw new Error(`Infographic dimensions differ from its recorded dimensions: ${filename}`);
  // Metadata alone can accept a damaged file. Decode all pixels before promotion.
  await sharp(data, decodeOptions).raw().toBuffer();
}
