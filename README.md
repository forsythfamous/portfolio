# forsythfamous.dev

Personal site of Forsyth Famous, Cloud Infrastructure & DevOps Engineer.
It is a static [Astro](https://astro.build) site on Cloudflare Pages that keeps itself current:

- **Build-time data**: `scripts/fetch-data.mjs` pulls public repositories, the contribution calendar,
  upstream pull requests and dev.to articles. Each source is optional; a failure is recorded, never hidden.
- **Control plane**: the home page panel reports the site's own pipeline. `/status.json` is written on every
  build and checked live from the visitor's browser.
- **Nightly deploys**: `.github/workflows/deploy.yml` builds and deploys on push to `main` and every night.
- **Case-study agent**: `.github/workflows/case-study-agent.yml` runs Claude Code weekly and opens a
  `case-study-draft` pull request when a repository deserves a write-up. Nothing ships without review.

## Local development

```bash
npm install
GITHUB_TOKEN=$(gh auth token) npm run fetch-data   # optional token enables the contribution calendar
npm run dev
npm run build    # fetch data, type-check, build to dist/
```

## Content

| What | Where |
|---|---|
| Profile, stats, certifications | `src/data/profile.ts` |
| Case studies | `src/content/case-studies/*.md` |
| Headshot | `src/assets/headshot.jpg` |
| Security headers (CSP, HSTS) | `public/_headers` |

## Repository secrets

| Secret | Used by | Notes |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Deploy | Token with *Cloudflare Pages: Edit* only |
| `CLOUDFLARE_ACCOUNT_ID` | Deploy | |
| `ANTHROPIC_API_KEY` | Case-study agent | |
| `GH_READ_TOKEN` | Deploy (optional) | Fine-grained, public repositories, read-only |
