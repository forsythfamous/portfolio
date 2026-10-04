import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const caseStudies = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/case-studies' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    order: z.number(),
    context: z.string(),
    outcome: z.string(),
    stack: z.array(z.string()),
    repo: z.url().optional(),
    private: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { caseStudies };
