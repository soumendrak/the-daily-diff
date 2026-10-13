/** HN timestamps are discovery evidence; publishers' original dates still need editorial verification. */
export function hnCandidate(item, day) {
  if (!item || item.type !== 'story' || item.deleted || item.dead ||
      new Date(item.time * 1000).toISOString().slice(0, 10) !== day) return null;
  const discussion = `https://news.ycombinator.com/item?id=${item.id}`;
  return { source: 'hn', id: String(item.id), title: item.title, url: item.url || discussion,
    discussion_url: discussion, discovered_at: new Date(item.time * 1000).toISOString(),
    author: item.by, points: item.score, comments: item.descendants || 0,
    original_publication_date: null, requires_editorial_review: true };
}

export function githubReleaseCandidate(repo, release, day) {
  if (release.draft || release.prerelease || !release.published_at?.startsWith(day + 'T')) return null;
  return { source: 'github', repository: repo, title: release.name || release.tag_name,
    url: release.html_url, published_at: release.published_at,
    original_publication_date: day, requires_editorial_review: true };
}
