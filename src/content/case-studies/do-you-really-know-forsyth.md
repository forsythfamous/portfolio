---
title: 'One image, three registries: a hardened container release'
summary: 'A React and Express app rebuilt as a small distroless image that runs as a non-root user, handles shutdown correctly, and was released as the same digest to Docker Hub, Azure Container Registry and Amazon ECR.'
order: 5
role: 'Container build, registry and release engineering'
period: 'Oct 2026'
status: 'Public · image on Docker Hub; ACR and ECR released, verified, then removed'
source: 'https://github.com/forsythfamous/do-you-really-know-forsyth'
stack: ['Docker', 'BuildKit', 'Distroless', 'Node.js 24', 'esbuild', 'Vite', 'Docker Hub', 'Azure Container Registry', 'Amazon ECR', 'Trivy']
diagram: 'dykf'
core: 'Build once, scan, and ship the identical digest to every registry.'
tldr:
  problem: 'The inherited image was 759 MB, ran as root, carried 395 MB of node_modules including dev dependencies, was based on an end-of-life Node release and could not receive its build-time configuration.'
  decision: 'Rebuild it from scratch: a lean build context, a bundled server with no runtime dependencies, a two-stage build onto a distroless non-root runtime, explicit signal handling, and one immutable image pushed to three registries.'
  result: 'The image went from 759 MB to 219 MB on disk, runs as UID 65532 with no shell, stops in about 0.2 s with exit code 0, and shows 0 critical and 0 high findings in both ECR basic scanning and Trivy. The manifest digest is the same in all three registries.'
decisions:
  - title: 'Remove node_modules from the runtime instead of pruning it'
    decision: 'Vite is imported only in the development branch of the server, and the server is bundled by esbuild into one ESM file. The runtime image contains the built frontend and that file, nothing else. The bundle goes to dist-server, not dist, because dist is served publicly.'
    options:
      - 'npm ci --omit=dev: barely shrinks the image, because the frontend libraries sit in dependencies.'
      - 'Bundle the server and drop node_modules entirely.'
    tradeoff: 'The server has to be bundled with a require shim for CommonJS dependencies, and the production start path differs from development.'
    evidence:
      - { label: 'server.ts', url: 'https://github.com/forsythfamous/do-you-really-know-forsyth/blob/main/server.ts' }
      - { label: 'package.json (build:server)', url: 'https://github.com/forsythfamous/do-you-really-know-forsyth/blob/main/package.json' }
  - title: 'Distroless runtime, driven by the scan results'
    decision: 'The first hardened build still showed 7 critical and 15 high findings in ECR, all from OS packages the app does not use (perl, gnutls, util-linux). Rather than patch them, the runtime moved to a distroless Node 24 image running as nonroot, with the health check calling the node binary directly.'
    options:
      - 'Stay on node:24-slim and patch or accept the findings.'
      - 'Remove what the app does not need: no shell, no package manager, no perl.'
    tradeoff: 'There is no shell to exec into, so debugging a running container needs other tooling, and the health check cannot use curl.'
    evidence:
      - { label: 'Dockerfile', url: 'https://github.com/forsythfamous/do-you-really-know-forsyth/blob/main/Dockerfile' }
      - { label: 'README section 10', url: 'https://github.com/forsythfamous/do-you-really-know-forsyth/blob/main/README.md' }
  - title: 'Handle SIGTERM, because the process is PID 1'
    decision: 'docker stop on the first hardened build took 10.2 s and exited 137, because a PID 1 without a signal handler ignores SIGTERM. The server now stops accepting connections, finishes in-flight requests, and exits, with an 8 s timer as a safety net under Docker''s 10 s.'
    options:
      - 'Add an init process such as tini.'
      - 'Handle the signal in the application, which needs no extra binary in a shell-less image.'
    tradeoff: 'Shutdown behaviour is application code that has to be kept correct.'
    evidence:
      - { label: 'server.ts (shutdown)', url: 'https://github.com/forsythfamous/do-you-really-know-forsyth/blob/main/server.ts' }
  - title: 'Immutable, traceable tags; no latest'
    decision: 'Every image carries a SemVer tag from package.json and a sha tag from git, plus OCI revision, version and source labels. latest is not used. ECR is configured with immutable tags so the registry rejects an overwrite.'
    options:
      - 'A moving latest tag: convenient, and impossible to roll back to or audit.'
      - 'Version and commit tags that are never reused.'
    tradeoff: 'Docker Hub and ACR Basic cannot enforce immutability, so on those the rule is a convention.'
    evidence:
      - { label: 'README sections 6 and 9', url: 'https://github.com/forsythfamous/do-you-really-know-forsyth/blob/main/README.md' }
  - title: 'Credentials: scoped, short-lived, no admin user'
    decision: 'Docker Hub uses a scoped expiring access token held in the OS keyring. ACR is created with the admin user disabled and accessed through Entra ID. ECR uses 12-hour tokens piped through stdin. No real secret is a build argument; the optional Gemini key is supplied at runtime only, and the Firebase web config baked into the bundle is public by design.'
    options:
      - 'Shared registry admin credentials and long-lived passwords in the Docker config.'
      - 'Per-registry short-lived or scoped credentials.'
    tradeoff: 'Setup is slower per registry, and the Dockerfile lint rule for secret-like names is skipped, with the reason written next to it.'
    evidence:
      - { label: 'Dockerfile', url: 'https://github.com/forsythfamous/do-you-really-know-forsyth/blob/main/Dockerfile' }
      - { label: 'README sections 7 to 9 and 12', url: 'https://github.com/forsythfamous/do-you-really-know-forsyth/blob/main/README.md' }
  - title: 'Prove it is the same artifact'
    decision: 'After the release, the manifest digest is read back from each registry for both the version tag and the sha tag, and all six match.'
    options:
      - 'Rebuild per registry and trust the tags.'
      - 'Build once, push the same image everywhere, compare digests.'
    tradeoff: 'None worth naming; the check is one command per registry.'
    evidence:
      - { label: 'README section 11', url: 'https://github.com/forsythfamous/do-you-really-know-forsyth/blob/main/README.md' }
failures:
  - { failure: 'Local secrets or git history baked into an image layer', detection: 'Build context size and contents are checked', mitigation: '.dockerignore excludes .env files, .git and node_modules; context is 625 kB', evidence: '.dockerignore' }
  - { failure: 'Dropped requests when the container is stopped', detection: 'Measured docker stop time and exit code', mitigation: 'SIGTERM handler; 0.2 s, exit 0', evidence: 'server.ts' }
  - { failure: 'Vulnerable packages that the app never uses', detection: 'ECR scan on push and Trivy', mitigation: 'Distroless runtime; 0 critical and 0 high in both', evidence: 'README section 10' }
  - { failure: 'A published tag silently changed', detection: 'Registry-side enforcement on ECR', mitigation: 'Immutable tags; tags never reused', evidence: 'README section 9' }
  - { failure: 'Architecture mismatch on arm64 hosts', detection: 'Known gap, documented', mitigation: 'Image is amd64 only; a multi-platform build is the next step', evidence: 'README section 14' }
next:
  - 'Build for linux/amd64 and linux/arm64 into the same index.'
  - 'Replace manual pushes with a workflow on version tags, using OIDC federation for Azure and AWS.'
  - 'Pin the base image by digest and let a dependency bot open update pull requests.'
updated: '2026-11-16'
---

## Context and constraints

The application is a small quiz with an Express server and a React frontend. The work was the delivery path around it:
a build that is small and reproducible, a runtime with as little in it as possible, and a release that can be checked
afterwards rather than trusted.

- **Starting point kept as a baseline.** The old image was 759 MB on disk and 144 MB compressed, ran as root and used
  `node:20-slim`. The new numbers are measured against it.
- **Reproducible.** `npm ci` installs exactly the lockfile, and the dependency layer is cached until the manifests change.
- **Cost-aware.** ACR Basic and ECR were created for the release, verified, and deleted afterwards, along with the
  temporary AWS access key. Docker Hub remains the public pull source.

## Verification

- **Image properties** (recorded in the README with screenshots): 219 MB on disk, 56.2 MB compressed, non-root user,
  no shell, healthy, and a 0.2 s clean stop.
- **Two scanners**: ECR basic scanning and Trivy agree on 0 critical and 0 high for 1.1.0.
- **Digest comparison** across Docker Hub, ACR and ECR for both tags.
- **No automated tests or CI workflow** exist in this repository for the image build; the verification is a documented,
  manual runbook, which is why moving it into a pipeline is the first next step.
