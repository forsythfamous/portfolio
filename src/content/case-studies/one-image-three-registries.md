---
title: 'One image, three registries: a hardened build with a verifiable digest'
summary: 'A React and Express app containerised from scratch: a multi-stage build onto a distroless non-root runtime, graceful shutdown, version and commit tagging, and one manifest digest published to Docker Hub, Azure Container Registry and Amazon ECR.'
order: 5
role: 'Container build, supply-chain hardening and release'
period: 'Oct 2026'
status: 'Public repository · Docker Hub image live; ACR and ECR torn down after verification'
source: 'https://github.com/forsythfamous/do-you-really-know-forsyth'
stack: ['Docker', 'BuildKit', 'distroless', 'Node.js 24', 'esbuild', 'Vite', 'React', 'Express', 'Docker Hub', 'Azure Container Registry', 'Amazon ECR', 'Trivy']
diagram: 'dykf'
core: 'Build once; publish the same digest everywhere.'
tldr:
  problem: 'An inherited image ran as root on an end-of-life Node release, carried 395 MB of dev dependencies and could not receive its build-time configuration.'
  decision: 'Rebuild it as a multi-stage image with no node_modules in the runtime, move to a distroless non-root base, and release one immutable, traceable image to three registries.'
  result: 'Per the repository README: 759 MB reduced to 219 MB, 7 critical and 15 high findings in the ECR scan reduced to none, docker stop from 10.2 s and SIGKILL to 0.2 s and exit 0, and the same manifest digest in all three registries.'
decisions:
  - title: 'Remove node_modules from the runtime instead of pruning it'
    decision: 'Vite is imported only in the development branch of the server, and the server is bundled with esbuild into one file. The runtime stage receives only the built client and that bundle. The bundle is written outside the publicly served directory.'
    options:
      - 'npm ci --omit=dev: little saving, because the frontend libraries are listed as runtime dependencies.'
      - 'Bundle the server and ship two artifacts.'
    tradeoff: 'Vite is marked external and the bundle needs a require shim for CommonJS dependencies; the build is more specific to this app.'
    evidence:
      - { label: 'Dockerfile', url: 'https://github.com/forsythfamous/do-you-really-know-forsyth/blob/main/Dockerfile' }
      - { label: 'README sections 3 and 4', url: 'https://github.com/forsythfamous/do-you-really-know-forsyth/blob/main/README.md' }
  - title: 'Distroless, non-root runtime'
    decision: 'The final stage is gcr.io/distroless/nodejs24-debian13:nonroot: no shell, no package manager, UID 65532, application files root-owned. The health check calls node directly because there is no curl or shell.'
    options:
      - 'Patch the slim Debian base: the findings were in OS packages the app does not use (perl, gnutls, util-linux).'
      - 'Remove what the app does not need.'
    tradeoff: 'No shell to exec into for debugging; the base is pinned by tag, not yet by digest.'
    exit: 'Pin the base image by digest and let a dependency bot propose updates.'
    evidence:
      - { label: 'Dockerfile', url: 'https://github.com/forsythfamous/do-you-really-know-forsyth/blob/main/Dockerfile' }
      - { label: 'README section 10', url: 'https://github.com/forsythfamous/do-you-really-know-forsyth/blob/main/README.md' }
  - title: 'Handle SIGTERM as PID 1'
    decision: 'Measured first: docker stop took 10.2 s and exited 137. A signal handler now stops accepting connections, lets in-flight requests finish and exits, with an 8-second safety timer under Docker''s 10-second grace period.'
    options:
      - 'Add an init process such as tini.'
      - 'Handle the signal in the application, with no extra component in the image.'
    tradeoff: 'Shutdown behaviour lives in application code and must be kept when the server changes.'
    evidence:
      - { label: 'server.ts', url: 'https://github.com/forsythfamous/do-you-really-know-forsyth/blob/main/server.ts' }
      - { label: 'README section 5', url: 'https://github.com/forsythfamous/do-you-really-know-forsyth/blob/main/README.md' }
  - title: 'Tag by version and commit; never use latest'
    decision: 'Each release has a SemVer tag from package.json and a sha- tag from git, plus OCI labels for version, revision and source. A pushed tag is never reused; ECR enforces this with immutable tags.'
    options:
      - 'A moving latest tag: convenient, and impossible to roll back to or audit.'
      - 'Immutable, traceable tags.'
    tradeoff: 'Consumers must name a version. Docker Hub and ACR Basic cannot enforce immutability, so there it is a rule rather than a control.'
    evidence:
      - { label: 'README sections 6 and 9', url: 'https://github.com/forsythfamous/do-you-really-know-forsyth/blob/main/README.md' }
  - title: 'No secrets in the image, no shared registry credentials'
    decision: 'The build context excludes .env files, .git and CI metadata. Only the public Firebase web configuration is a build argument, with the linter exception documented in the Dockerfile; the Gemini key is runtime-only. Docker Hub uses a scoped token, ACR used Entra ID with the admin user disabled, and ECR used short-lived tokens.'
    options:
      - 'Pass every setting as a build argument.'
      - 'Separate public build-time configuration from runtime secrets.'
    tradeoff: 'The browser bundle contains the Firebase web configuration by design; protection of the data rests on the Firestore rules.'
    evidence:
      - { label: '.dockerignore', url: 'https://github.com/forsythfamous/do-you-really-know-forsyth/blob/main/.dockerignore' }
      - { label: 'firestore.rules', url: 'https://github.com/forsythfamous/do-you-really-know-forsyth/blob/main/firestore.rules' }
      - { label: 'README section 12', url: 'https://github.com/forsythfamous/do-you-really-know-forsyth/blob/main/README.md' }
failures:
  - { failure: 'Rebuilding reinstalls all dependencies', detection: 'Build log shows whether npm ci was cached', mitigation: 'Manifests copied before source; build arguments declared after install', evidence: 'Dockerfile' }
  - { failure: 'Secrets enter an image layer', detection: 'Build context size and contents', mitigation: '.dockerignore excludes .env and .git; secrets only at runtime', evidence: '.dockerignore' }
  - { failure: 'Rolling deploy drops requests', detection: 'docker stop time and exit code', mitigation: 'SIGTERM handler drains in-flight requests', evidence: 'server.ts' }
  - { failure: 'Vulnerable OS packages in the base', detection: 'ECR scan on push, cross-checked with Trivy', mitigation: 'Distroless base with no shell or package manager', evidence: 'README section 10' }
  - { failure: 'Registries diverge', detection: 'imagetools inspect digest per registry', mitigation: 'One build, tagged and pushed in a loop', evidence: 'README section 11' }
next:
  - 'Build for linux/arm64 as well, so the image runs on Graviton; today it is amd64 only.'
  - 'Replace manual pushes with a workflow on version tags that builds once and pushes to every registry, using OIDC for Azure and AWS.'
  - 'Pin the base image by digest.'
updated: '2026-11-06'
---

## Context and constraints

The repository started with a working but naive Dockerfile. I removed it on a dedicated branch and rebuilt the image
from scratch, keeping the old image as a measured baseline. The README is written as a runbook: every number in it is
paired with the command or screenshot that produced it.

| | Inherited | 1.0.0 | 1.1.0 |
|---|---|---|---|
| Runtime base | node:20-slim | node:24-slim | distroless nodejs24, nonroot |
| Image size on disk | 759 MB | 335 MB | 219 MB |
| Runs as | root | node (UID 1000) | nonroot (UID 65532) |
| Shell in container | yes | yes | none |
| ECR scan, critical / high | not recorded | 7 / 15 | 0 / 0 |

## How a release works

1. `docker build` runs both stages; version and commit SHA are read from `package.json` and git and written as tags and OCI labels.
2. The image is pushed to Docker Hub, ACR and ECR in a single loop, which is the unit a CI job would later run.
3. `docker buildx imagetools inspect` is run against each registry and the digests are compared.
4. ECR scans on push and Trivy is run separately; the two disagree on totals because their databases differ, but
   agree on the verdict.

## Verification and cost

- The README records the digest, the size, the scan results and the stop time for each version, with screenshots.
- ACR and ECR were deleted after verification and the temporary AWS access key was removed, so the recorded digests and
  screenshots are the evidence for those two registries. Docker Hub remains the public source.
- There is no CI workflow in this repository yet; releases were run by hand. That is the first item under next steps.
