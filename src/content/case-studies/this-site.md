---
title: 'This site: a portfolio that operates itself'
summary: 'A static site whose content, status panel and case-study drafts are kept current by its own pipeline.'
order: 5
context: 'Platform engineering · Cloudflare & GitHub'
outcome: 'Nightly rebuilds, live status panel, AI drafts gated by pull request'
stack: ['Astro', 'Cloudflare Pages', 'GitHub Actions', 'GitHub API', 'Claude Code', 'Playwright']
repo: 'https://github.com/forsythfamous/portfolio'
---

## Why build it this way

A portfolio goes stale the week after it is published. Instead of promising to update it, I made keeping it current
the system's job, and made the system visible: the control-plane panel on the home page is fed by the same pipeline it reports on.

## How it works

- **Build-time data.** A fetch step pulls public repositories, the contribution calendar, upstream pull requests and
  articles from the GitHub and dev.to APIs. Each source is optional: if one fails, the build still ships and the
  failure is recorded instead of hidden.
- **Scheduled deploys.** GitHub Actions rebuilds and deploys to **Cloudflare Pages** on every push to `main` and
  every night, so the site reflects GitHub without anyone touching it.
- **A status endpoint.** Each build writes `/status.json`. The panel reads it in your browser and measures the
  round trip, so what you see is the live state of the deployed site.
- **An agent, behind a gate.** A weekly workflow runs Claude Code against my public repositories. When a project is new
  or has changed significantly, it drafts a case study and opens a pull request labelled `case-study-draft`.
  Nothing reaches the site until I review and merge it.

## Security

- No client-side framework and no third-party scripts; fonts are self-hosted.
- A strict Content Security Policy (`script-src 'self'`) and HSTS are set at the edge.
- Secrets live in GitHub Actions; the GitHub token used at build time is read-only.
