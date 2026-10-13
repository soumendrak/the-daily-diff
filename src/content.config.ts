import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { observabilityIssueSchema } from './lib/observabilitySchema.js';

const observability = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/ai-observability' }),
  schema: observabilityIssueSchema,
});
export const collections = { observability };
