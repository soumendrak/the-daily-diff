/** @param {string} source @param {number | undefined} score @param {string} sourceFilter @param {string} signalFilter */
export function matchesStoryFilters(source, score, sourceFilter, signalFilter) {
  if (source !== sourceFilter) return false;
  if (signalFilter === 'all') return true;
  const threshold = Number(signalFilter);
  return Number.isFinite(score) && score >= threshold;
}

/** Preserve explicitly supplied images. Legacy upstream infographic paths use its original CDN.
 * @param {string | undefined} image
 */
export function resolveStoryImage(image) {
  if (!image) return null;
  return image.startsWith('/infographics/') ? 'https://tdd-edge.b-cdn.net/' + image : image;
}
