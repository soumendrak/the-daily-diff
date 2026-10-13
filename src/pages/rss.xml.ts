import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const editions = (await getCollection('observability')).map((entry) => entry.data).sort((a, b) => b.date.localeCompare(a.date));
  return rss({
    title: 'Tidy Traces — AI Observability Daily',
    description: 'Daily coverage of observability, AI evaluations, and AI-agent observability.',
    site: context.site!,
    items: editions.map((edition) => ({
      title: `AI Observability Daily — ${edition.date}`,
      pubDate: new Date(`${edition.date}T00:00:00Z`),
      description: edition.dek,
      link: `/ai-observability/${edition.date}/`,
    })),
  });
}
