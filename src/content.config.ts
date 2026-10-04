import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// A piece of evidence: a PR, commit, file or test. Private repositories have
// no public URL, so `url` is optional and the label is shown as plain text.
const evidence = z.object({ label: z.string(), url: z.url().optional() });

const caseStudies = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/case-studies' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    order: z.number(),
    role: z.string(),
    period: z.string(),
    status: z.string(),
    source: z.union([z.literal('private'), z.url()]),
    stack: z.array(z.string()),
    diagram: z.enum(['konta', 'azure', 'jahus', 'site']),
    core: z.string(), // the one-line core decision shown on the card
    tldr: z.object({ problem: z.string(), decision: z.string(), result: z.string() }),
    decisions: z.array(
      z.object({
        title: z.string(),
        decision: z.string(),
        options: z.array(z.string()),
        tradeoff: z.string(),
        exit: z.string().optional(),
        evidence: z.array(evidence),
      }),
    ),
    failures: z.array(
      z.object({ failure: z.string(), detection: z.string(), mitigation: z.string(), evidence: z.string() }),
    ),
    next: z.array(z.string()),
    updated: z.string(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { caseStudies };
