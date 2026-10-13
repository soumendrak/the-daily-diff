/** Consecutive UTC publication dates; latest ends at the newest available issue.
 * @param {string[]} dates
 */
export function publicationStreaks(dates) {
  const days = [...new Set(dates)].sort().map((date) => {
    const value = Date.parse(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== date) {
      throw new Error(`Invalid publication date: ${date}`);
    }
    return value;
  });
  let latest = 0;
  let longest = 0;
  days.forEach((day, index) => {
    latest = index > 0 && day - days[index - 1] === 86400000 ? latest + 1 : 1;
    longest = Math.max(longest, latest);
  });
  return { latest, longest };
}
