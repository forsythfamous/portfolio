---
title: 'This site: a portfolio that operates itself'
summary: 'A static site whose content, live status diagram and case-study drafts are kept current by its own pipeline, and which only shows claims a repository can back.'
order: 3
role: 'Design, build and operations'
period: 'Oct 2026'
status: 'Public source'
source: 'https://github.com/forsythfamous/portfolio'
stack: ['Astro', 'Cloudflare Pages', 'GitHub Actions', 'GitHub API', 'dev.to API', 'Playwright']
diagram: 'site'
core: 'An agent may propose content; only a reviewed pull request can publish it.'
tldr:
  problem: 'A portfolio goes stale the week it is published, and most of what portfolios claim cannot be checked.'
  decision: 'Make keeping it current the pipeline''s job, show the pipeline on the home page, and publish nothing a repository cannot back.'
  result: 'Nightly rebuilds from the GitHub and dev.to APIs, a live status diagram measured from the visitor''s browser, and an agent that can only open pull requests.'
decisions:
  - title: 'Every source is optional; failures are shown, not hidden'
    decision: 'The build fetches each source inside a wrapper that records failures instead of throwing. A broken API produces a warning on the diagram, not a broken site.'
    options:
      - 'Fail the build when an API fails: the site stops updating whenever GitHub has a bad hour.'
      - 'Ship with the last good data and say so.'
    tradeoff: 'A build can ship with a partial view; the status diagram makes that visible.'
    evidence:
      - { label: 'scripts/fetch-data.mjs', url: 'https://github.com/forsythfamous/portfolio/blob/main/scripts/fetch-data.mjs' }
  - title: 'Static, rebuilt nightly'
    decision: 'No server and no runtime API calls. GitHub Actions rebuilds on every push to main and every night, and deploys to Cloudflare Pages.'
    options:
      - 'Server-side rendering with live API calls: always fresh, and a server to run and rate limits to manage.'
      - 'Static output on a schedule.'
    tradeoff: 'Content can be up to a day old; the footer and the diagram say exactly how old.'
    evidence:
      - { label: '.github/workflows/deploy.yml', url: 'https://github.com/forsythfamous/portfolio/blob/main/.github/workflows/deploy.yml' }
  - title: 'A strict CSP with nothing inline'
    decision: 'script-src and style-src are both self. All JavaScript is in external files, stylesheets are never inlined, assets are never inlined as data: URIs, and diagrams are SVG with no style attributes. CI fails the build if anything inline appears.'
    options:
      - 'Allow unsafe-inline: easier, and it removes most of what a CSP is for.'
      - 'Make the build produce nothing inline, and test for it.'
    tradeoff: 'Some framework conveniences are off, and code highlighting is plain.'
    evidence:
      - { label: 'public/_headers', url: 'https://github.com/forsythfamous/portfolio/blob/main/public/_headers' }
      - { label: '.github/workflows/ci.yml', url: 'https://github.com/forsythfamous/portfolio/blob/main/.github/workflows/ci.yml' }
  - title: 'The agent proposes; review commits'
    decision: 'A weekly workflow runs an AI agent against my public repositories. When one is new or has changed significantly, it drafts a case study and opens a pull request labelled case-study-draft, listing the files it relied on. It has no path to main except a reviewed merge.'
    options:
      - 'Let the agent commit to main: always current, and unreviewed claims in public.'
      - 'Pull requests only.'
    tradeoff: 'Content waits for review.'
    evidence:
      - { label: '.github/workflows/case-study-agent.yml', url: 'https://github.com/forsythfamous/portfolio/blob/main/.github/workflows/case-study-agent.yml' }
  - title: 'Only evidence-backed content'
    decision: 'Repositories appear only if an audit marked them worth showing, and every claim in a case study traces to a file, test or pull request.'
    options:
      - 'List every public repository automatically.'
      - 'Curate against an evidence ledger.'
    tradeoff: 'Less on the page; everything on it holds up.'
    evidence:
      - { label: 'src/data/showcase-repos.json', url: 'https://github.com/forsythfamous/portfolio/blob/main/src/data/showcase-repos.json' }
failures:
  - { failure: 'GitHub or dev.to API down', detection: 'Fetch wrapper records the error', mitigation: 'Build ships; node shows a warning', evidence: 'fetch-data.mjs' }
  - { failure: 'Inline script or style slips in', detection: 'CI grep on the build output', mitigation: 'Build fails before deploy', evidence: 'ci.yml' }
  - { failure: 'Agent drafts an unsupported claim', detection: 'PR review against cited files', mitigation: 'Not merged', evidence: 'case-study-agent.yml' }
  - { failure: 'Visitor has a stale page', detection: 'Live status.json SHA differs', mitigation: 'Status line says a newer build is live', evidence: 'control-plane.js' }
next:
  - 'Add an uptime monitor to the status diagram once the site is on its own domain.'
  - 'Run the link and layout checks as a Playwright job in CI.'
updated: '2026-10-05'
---

## How a build works

1. A push to `main`, the nightly schedule or a manual run starts the deploy workflow.
2. `scripts/fetch-data.mjs` pulls repositories, upstream pull requests, the contribution total and articles. Each source
   is wrapped so that a failure is recorded rather than thrown:

```js
async function attempt(source, fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    errors.push({ source, message: String(err.message ?? err) });
    return fallback;
  }
}
```

3. Astro type-checks and builds static HTML. Diagrams are laid out at build time and emitted as SVG, so no layout code
   runs in the browser.
4. The build writes `/status.json`, the same data the home-page diagram is drawn from, and deploys to Cloudflare Pages.
5. In the browser, one small script measures a round trip to `/status.json`, marks the edge node, and reports whether a
   newer build is live.

## Verification

- `astro check` type-checks every build.
- CI fails if the output contains inline scripts, inline styles or `data:` URIs that the CSP would block.
- Links, anchors and layouts at 375, 768 and 1440 pixels are checked with Playwright before changes ship.
