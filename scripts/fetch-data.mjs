// Pulls everything the site shows from external sources at build time and
// writes it to src/data/generated.json (consumed by the pages) and
// public/status.json (polled live by the control-plane panel).
//
// Every source is optional: if one fails, the build still succeeds and the
// failure is recorded so the panel can report it honestly.
//
// Usage: node scripts/fetch-data.mjs [--if-missing]
//   GITHUB_TOKEN  optional; enables the contribution calendar and higher rate limits.

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const GH_USER = 'forsythfamous';
const SITE_REPO = 'forsythfamous/portfolio';
const DEVTO_USER = 'forsyth_famous_';
const AGENT_LABEL = 'case-study-draft';
const EXCLUDE_REPOS = new Set(['forsythfamous', 'portfolio']);
// Upstream PRs that only add a name to a contributors list are not shown.
const SKIP_PR_TITLE = /contributors?\b/i;

const OUT = 'src/data/generated.json';
const STATUS_OUT = 'public/status.json';

if (process.argv.includes('--if-missing') && existsSync(OUT)) process.exit(0);

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const errors = [];

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `${GH_USER}-portfolio`,
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

async function ghGraphql(query) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': `${GH_USER}-portfolio` },
    body: JSON.stringify({ query }),
  });
  const body = await res.json();
  if (!res.ok || body.errors) throw new Error(`GraphQL -> ${res.status} ${JSON.stringify(body.errors ?? '')}`);
  return body.data;
}

async function attempt(source, fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    errors.push({ source, message: String(err.message ?? err) });
    console.warn(`[fetch-data] ${source}: ${err.message ?? err}`);
    return fallback;
  }
}

const repos = await attempt('github.repos', async () => {
  const list = await gh(`/users/${GH_USER}/repos?type=owner&sort=pushed&per_page=100`);
  return list
    .filter((r) => !r.fork && !r.private && !r.archived && !EXCLUDE_REPOS.has(r.name))
    .map((r) => ({
      name: r.name,
      description: r.description ?? '',
      url: r.html_url,
      homepage: r.homepage || null,
      language: r.language,
      stars: r.stargazers_count,
      topics: r.topics ?? [],
      pushedAt: r.pushed_at,
    }));
}, []);

const contributions = token
  ? await attempt('github.contributions', async () => {
      const data = await ghGraphql(`{
        user(login: "${GH_USER}") {
          contributionsCollection {
            contributionCalendar {
              totalContributions
              weeks { contributionDays { date contributionCount } }
            }
          }
        }
      }`);
      const cal = data.user.contributionsCollection.contributionCalendar;
      return {
        total: cal.totalContributions,
        weeks: cal.weeks.map((w) => w.contributionDays.map((d) => [d.date, d.contributionCount])),
      };
    }, null)
  : null;

// Pull requests to repositories owned by someone else: upstream contributions.
const upstream = await attempt('github.upstream', async () => {
  const q = encodeURIComponent(`is:pr is:public author:${GH_USER} -user:${GH_USER}`);
  const res = await gh(`/search/issues?q=${q}&sort=created&order=desc&per_page=20`);
  return (res?.items ?? [])
    .filter((pr) => (pr.state === 'open' || pr.pull_request?.merged_at) && !SKIP_PR_TITLE.test(pr.title))
    .map((pr) => ({
      title: pr.title,
      url: pr.html_url,
      repo: pr.repository_url.replace('https://api.github.com/repos/', ''),
      number: pr.number,
      state: pr.pull_request?.merged_at ? 'merged' : 'open',
      at: pr.pull_request?.merged_at ?? pr.created_at,
    }));
}, []);

const articles = await attempt('devto.articles', async () => {
  const res = await fetch(`https://dev.to/api/articles?username=${DEVTO_USER}&per_page=6`);
  if (!res.ok) throw new Error(`dev.to -> ${res.status}`);
  const list = await res.json();
  return list.map((a) => ({
    title: a.title,
    url: a.url,
    publishedAt: a.published_at,
    readingMinutes: a.reading_time_minutes,
    tags: a.tag_list,
  }));
}, []);

// Pipeline state of this site's own repository. A missing repo (before the
// first push) is reported as "not yet run", not as a failure.
const pipeline = await attempt('github.pipeline', async () => {
  const runs = await gh(`/repos/${SITE_REPO}/actions/runs?branch=main&per_page=10`);
  const deploys = (runs?.workflow_runs ?? []).filter((r) => r.name === 'Deploy' && r.status === 'completed');
  const last = deploys[0];
  return last
    ? { workflow: last.name, conclusion: last.conclusion, at: last.updated_at, url: last.html_url, runNumber: last.run_number }
    : null;
}, null);

const agent = await attempt('github.agent', async () => {
  const prs = await gh(`/repos/${SITE_REPO}/pulls?state=open&per_page=50`);
  const runs = await gh(`/repos/${SITE_REPO}/actions/workflows/case-study-agent.yml/runs?per_page=1`);
  const drafts = (prs ?? []).filter((p) => p.labels.some((l) => l.name === AGENT_LABEL));
  const lastRun = runs?.workflow_runs?.[0];
  return {
    openDrafts: drafts.length,
    drafts: drafts.slice(0, 3).map((p) => ({ title: p.title, url: p.html_url })),
    lastRun: lastRun ? { conclusion: lastRun.conclusion ?? lastRun.status, at: lastRun.updated_at, url: lastRun.html_url } : null,
  };
}, null);

function gitSha() {
  const fromEnv = process.env.GITHUB_SHA || process.env.CF_PAGES_COMMIT_SHA;
  if (fromEnv) return fromEnv;
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
}

const build = {
  at: new Date().toISOString(),
  sha: gitSha(),
  runId: process.env.GITHUB_RUN_ID ?? null,
  trigger: process.env.GITHUB_EVENT_NAME ?? 'local',
  environment: process.env.GITHUB_ACTIONS ? 'ci' : 'local',
};

const data = { build, repos, contributions, upstream, articles, pipeline, agent, errors };

mkdirSync('src/data', { recursive: true });
writeFileSync(OUT, JSON.stringify(data, null, 2));
writeFileSync(
  STATUS_OUT,
  JSON.stringify({
    build,
    sources: {
      github: !errors.some((e) => e.source.startsWith('github')),
      devto: !errors.some((e) => e.source.startsWith('devto')),
    },
    repos: repos.length,
    pipeline,
    agent: agent && { openDrafts: agent.openDrafts },
  }),
);

console.log(
  `[fetch-data] ${repos.length} repos, ${upstream.length} upstream PRs, ${articles.length} articles, ` +
    `contributions=${contributions?.total ?? 'n/a'}, errors=${errors.length}`,
);
