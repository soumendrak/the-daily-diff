# Agent Instructions & Conventions

Tidy Traces is an AI-observability-only fork of https://github.com/arpitbbhayani/the-daily-diff. Preserve the original manifesto: distraction-free reading, depth over noise, original sources, useful summaries, and stable newspaper typography.

- AI Observability opens at `/` on `https://tidytraces.com`. There is no engineering edition or engineering navigation tab.
- Use the original newspaper reader in `src/components/EditionPage.astro`; do not create an unrelated landing-page design.
- Keep all real AI issues in `src/data/ai-observability/`. Dated routes are `/ai-observability/YYYY-MM-DD/`; `/archive/` is the calendar. Never remove previous AI issues when adding a new one.
- HN, NEWS, GITHUB are mutually exclusive source tabs, ordered exactly that way. They are discovery channels for AI-observability stories, not separate engineering topics. Default to the first source with stories.
- Signal filters are All, Recommended (recorded `interest_score` >= 8), Must-Read (>= 9). Missing scores appear only under All; never invent scores to populate filters.
- Calendars show consecutive publication dates, not inferred personal reading streaks. Do not fabricate issues to fill gaps.
- Every newly generated daily story, including every brief, requires its own reviewed AI-generated editorial infographic. Use built-in image generation only; stop if unavailable. Store local PNG assets and generation provenance. Label generated work clearly; preserve attribution for existing source images. Legacy `/infographics/` paths use the upstream CDN. Never borrow unrelated graphics.
- `npm run fetch:sources -- --date YYYY-MM-DD` discovers HN submissions and GitHub watchlist releases. The manually triggered discovery workflow uploads candidates for review; it never silently publishes them. HN submission time alone does not prove original article publication date.
- Daily curation uses `skills/ai-observability-newspaper` and `scripts/run-daily-newspaper.js`. The runner publishes verified editions automatically when invoked; do not activate a schedule without a request. Freeze the previous-day `story_window`, or the explicit news-day override. Verify original publication evidence, never modification/resurfacing dates, and deduplicate within each issue and across all history. Empty issues require completed source checks.
- Write full `body` paragraphs, normally 150–220 words (at least 130 for full stories). A source-specific reason may justify a 60+ word brief; it still requires an infographic. Keep editorial takeaways distinct and never pad with invented facts.
- Build selects the latest issue for `/`, `/md`, `/json`, and RSS, while preserving dated pages. `.github/workflows/verify.yml` checks PRs and master pushes; it does not curate stories or deploy.
- Styles use SASS newsprint theme variables in `src/styles/main.scss`.
- Start development in background mode: `npm run dev -- --background`. Manage with `npx astro dev status`, `npx astro dev logs`, `npx astro dev stop`.
- Before committing: `npm test`, `npm run check`, `npm run build`.
- `npm run preview:cf` previews Worker static assets. `npm run deploy` builds and deploys using authenticated Wrangler. Existing Pages Git integration may publish master instead.
- Canonical origin is fixed at `https://tidytraces.com`; an old dashboard `SITE_URL` value must not change it.

Astro reference: https://docs.astro.build
