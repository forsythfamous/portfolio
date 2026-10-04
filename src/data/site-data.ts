// Typed view of src/data/generated.json, which is written by
// scripts/fetch-data.mjs at build time. Inferring types from the JSON itself
// would break whenever a source is temporarily empty or null.
import raw from './generated.json';

export interface Repo {
  name: string;
  description: string;
  url: string;
  homepage: string | null;
  language: string | null;
  stars: number;
  topics: string[];
  pushedAt: string;
}

export interface UpstreamPr {
  title: string;
  url: string;
  repo: string;
  number: number;
  state: 'merged' | 'open';
  at: string;
  additions?: number;
  deletions?: number;
}

export interface SiteData {
  build: { at: string; sha: string | null; runId: string | null; trigger: string; environment: 'ci' | 'local' };
  repos: Repo[];
  contributions: { total: number } | null;
  upstream: UpstreamPr[];
  articles: { title: string; url: string; publishedAt: string; readingMinutes: number; tags: string[] }[];
  pipeline: { workflow: string; conclusion: string | null; at: string; url: string; runNumber: number } | null;
  agent: {
    openDrafts: number;
    drafts: { title: string; url: string }[];
    lastRun: { conclusion: string; at: string; url: string } | null;
  } | null;
  errors: { source: string; message: string }[];
}

export const data = raw as unknown as SiteData;
