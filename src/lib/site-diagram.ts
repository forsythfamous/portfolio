// The hero topology: this site's own pipeline, with each node's status taken
// from the build-time fetch. The edge node is updated live in the browser.
import { data } from '../data/site-data';
import type { Diagram, State } from './topology';

const failed = (prefix: string) => data.errors.some((e) => e.source.startsWith(prefix));
const short = (sha: string | null) => sha?.slice(0, 7) ?? 'local';

const pipelineState: State | undefined = data.pipeline
  ? data.pipeline.conclusion === 'success'
    ? 'ok'
    : 'error'
  : undefined;

const agentState: State | undefined = data.agent?.lastRun
  ? data.agent.lastRun.conclusion === 'success'
    ? data.agent.openDrafts > 0
      ? 'warn'
      : 'ok'
    : 'error'
  : undefined;

export const isDevBuild = data.build.environment === 'local';

export const siteDiagram: Diagram = {
  id: 'site',
  title: 'How this site is built and served',
  summary:
    'Pushes and a nightly schedule run the deploy workflow, which pulls from the GitHub and dev.to APIs and ships to Cloudflare Pages. The case-study agent can only propose changes through a reviewed pull request.',
  components: [
    {
      id: 'agent',
      name: 'Case-study agent',
      kind: 'ci',
      tech: data.agent?.lastRun ? `${data.agent.openDrafts} draft(s) in review` : 'weekly · PR-gated',
      col: 0,
      row: 0,
      status: agentState,
      note: 'Weekly Claude Code run. Drafts a case study when a public repository is new or has changed significantly, and opens a pull request labelled case-study-draft. Nothing ships until it is reviewed and merged.',
      href: 'https://github.com/forsythfamous/portfolio/pulls?q=label%3Acase-study-draft',
    },
    {
      id: 'ghapi',
      name: 'GitHub API',
      kind: 'external',
      tech: data.contributions ? `${data.contributions.total} contributions / yr` : 'repos · upstream PRs',
      col: 0,
      row: 1,
      status: failed('github') ? 'warn' : 'ok',
    },
    {
      id: 'devto',
      name: 'dev.to API',
      kind: 'external',
      tech: `${data.articles.length} recent articles`,
      col: 0,
      row: 2,
      status: failed('devto') ? 'warn' : 'ok',
    },
    {
      id: 'repo',
      name: 'portfolio repo',
      kind: 'service',
      tech: `main @ ${short(data.build.sha)}`,
      col: 1,
      row: 0,
      href: 'https://github.com/forsythfamous/portfolio',
    },
    {
      id: 'actions',
      name: 'Deploy workflow',
      kind: 'ci',
      tech: data.pipeline ? `run #${data.pipeline.runNumber} · ${data.pipeline.conclusion}` : 'push + nightly',
      col: 1,
      row: 1,
      status: pipelineState,
      note: 'Fetches data, type-checks, builds and deploys. Each external source is optional: a failure is recorded on this diagram instead of failing the site.',
      href: data.pipeline?.url,
    },
    {
      id: 'pages',
      name: 'Cloudflare Pages',
      kind: 'edge',
      tech: 'checking…',
      col: 2,
      row: 1,
      status: 'idle',
      note: 'Serves the static build with a strict Content Security Policy and HSTS. The status shown here is measured by your browser against /status.json.',
    },
    { id: 'you', name: 'You', kind: 'client', tech: 'this browser', col: 3, row: 1 },
  ],
  flows: [
    { from: 'agent', to: 'repo', label: 'pull request, merged only after review', type: 'control' },
    { from: 'repo', to: 'actions', label: 'push to main', type: 'control' },
    { from: 'ghapi', to: 'actions', label: 'repos, upstream PRs, contributions', type: 'data' },
    { from: 'devto', to: 'actions', label: 'articles', type: 'data' },
    { from: 'actions', to: 'pages', label: 'deploy build + status.json', type: 'control' },
    { from: 'pages', to: 'you', label: 'pages', type: 'data' },
    { from: 'you', to: 'pages', label: 'live status check', type: 'data' },
  ],
  boundaries: [],
};

/** Plain rows for the "view as table" alternative and the status line. */
export const statusRows = siteDiagram.components
  .filter((c) => c.status !== undefined && c.id !== 'pages')
  .map((c) => ({ id: c.id, name: c.name, state: c.status!, detail: c.tech }));
