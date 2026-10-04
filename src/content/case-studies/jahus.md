---
title: 'JahUs: deploys that refuse to go wrong'
summary: 'A two-player web game used as the proving ground for environment isolation, guarded production releases and a client that cannot write to its own database.'
order: 2
role: 'Platform, security and release engineering'
period: 'Sep – Oct 2026'
status: 'Private · staging; production provisioned, not yet released'
source: 'private'
stack: ['Firebase Hosting', 'Cloud Functions v2', 'Firestore', 'Firebase Auth', 'App Check', 'Cloud Monitoring', 'GitHub Actions', 'Playwright', 'TypeScript']
diagram: 'jahus'
core: 'Production changes only from a release tag, through a script that verifies its own result.'
tldr:
  problem: 'Several Firebase projects live on one account: an emulator project, staging, production, an earlier beta and unrelated ones. A mistyped alias or a default project is all it takes to ship to the wrong place.'
  decision: 'Make the safe path the only path: allowlisted targets, tagged releases, a typed confirmation, and checks after every deploy.'
  result: 'Separate emulator, staging and production projects; a client with no write access; App Check enforced on staging after a monitored rollout; 468 automated test cases including 34 security-rule tests.'
decisions:
  - title: 'Clients never write to Firestore'
    decision: 'Every mutation goes through one of 16 callable functions, all built on one wrapper: authentication required, the user id taken only from the verified token, strict input schemas that reject unknown fields, and App Check enforced by a parameter that defaults to on.'
    options:
      - 'Validate writes in security rules: no function cold starts, but validation split across rules and code.'
      - 'Server-only writes: the rules become read-only and trivially reviewable.'
    tradeoff: 'Higher latency and function cost on every write. In exchange, multi-document writes are transactional and the attack surface is one wrapper.'
    evidence:
      - { label: 'firestore.rules' }
      - { label: 'functions/src/callable.ts' }
      - { label: 'tests/rules/firestore.rules.test.ts' }
  - title: 'Production only from a release tag, never from CI'
    decision: 'The production deploy refuses to run in CI, on a dirty tree, or on a commit without an annotated vX.Y.Z tag already on origin/main, and the operator must type the project id. It re-runs typecheck, lint, unit and emulator tests first.'
    options:
      - 'Continuous deployment from CI: faster, and puts production credentials in CI.'
      - 'Operator-run, tag-gated deploys: every production change is deliberate.'
    tradeoff: 'No continuous deployment, and releases depend on one operator workstation.'
    evidence:
      - { label: 'scripts/deploy/production-guard.mjs' }
      - { label: 'scripts/deploy/production.mjs' }
      - { label: 'scripts/deploy/production-guard.test.ts' }
  - title: 'Allowlist the targets, blocklist the neighbours'
    decision: 'A deploy target must match exactly one approved project id; the earlier beta, staging, demo and unrelated projects are blocklisted explicitly. The env file and the built bundle are checked to reference only the target project.'
    options:
      - 'Trust Firebase aliases and the gcloud default project.'
      - 'Allowlist-first, with tests that keep staging and production configs isolated.'
    tradeoff: 'Adding an environment is a code change with tests.'
    evidence:
      - { label: 'scripts/deploy/targets.mjs' }
      - { label: 'scripts/deploy/config-isolation.test.ts' }
  - title: 'Verify the deploy, do not assume it'
    decision: 'After deploying, the script checks the Firestore location and delete protection, compares the deployed function inventory and region with an expected list, and checks that the latest Hosting release carries the deployed commit SHA.'
    options:
      - 'Treat a zero exit code from the deploy CLI as success.'
      - 'Assert the intended end state.'
    tradeoff: 'More script to maintain; any drift fails loudly.'
    evidence:
      - { label: 'scripts/deploy/production.mjs' }
  - title: 'App Check: monitor first, then enforce'
    decision: 'App Check was rolled out in stages on staging, from monitor mode to enforced on Functions, Firestore and Auth, with a probe test that proves enforcement. The enforcement parameter defaults to on, so a new environment is protected unless it opts out.'
    options:
      - 'Enforce immediately: risks locking out real users before verified traffic is seen.'
      - 'Staged rollout with a fail-closed default.'
    tradeoff: 'Production remains in monitor mode until its own monitoring window completes.'
    evidence:
      - { label: 'docs/architecture/APP_CHECK.md' }
      - { label: 'e2e/staging/appcheck-enforcement.spec.ts' }
failures:
  - { failure: 'Deploy aimed at the wrong project', detection: 'Target not on the allowlist, or blocklisted', mitigation: 'Refused before anything runs', evidence: 'targets.mjs' }
  - { failure: 'Production deploy started from CI', detection: 'CI environment detected', mitigation: 'Refused', evidence: 'production-guard.mjs' }
  - { failure: 'Untagged or dirty commit', detection: 'No annotated tag on origin/main', mitigation: 'Refused', evidence: 'production-guard.test.ts' }
  - { failure: 'Deploy drifts from intent', detection: 'Post-deploy assertions', mitigation: 'Fails with the specific mismatch', evidence: 'production.mjs' }
  - { failure: 'Scheduled job partly fails', detection: 'Partial failure reported as failed execution', mitigation: 'Alert policy fires; next run resumes', evidence: 'functions/src/index.ts' }
  - { failure: 'Abuse of invites and actions', detection: 'Per-user fixed-window counters', mitigation: 'Rate-limited; invite codes stored only as hashes', evidence: 'services/rateLimit.ts' }
next:
  - 'Re-baseline the visual regression suite so CI on main is green again.'
  - 'Move project, billing, budget and Auth configuration into Terraform; today only rules, indexes, functions, hosting and monitoring are code.'
  - 'Add a Content-Security-Policy and frame-ancestors to the Hosting headers.'
  - 'Enforce App Check on production before the first release.'
  - 'Add a missed-run watchdog for the daily jobs.'
updated: '2026-10-05'
---

## Context and constraints

JahUs is a relationship game for two people. The product is small; the platform around it was built as if it were not.
The interesting problems were operational: keeping environments apart, making production changes deliberate, and
making sure personal answers can never leak between players.

- **Three isolated projects.** An emulator-only demo project, staging and production. The default alias points at the
  emulator project and never at production.
- **Private by construction.** A private answer is readable only by its author and cannot be listed. Operational logs
  have no free-form payload field, resource ids are one-way hashed, and errors are logged by category only.
- **A data lifecycle.** Users can export their data and delete their account; closed pairs and expired content are
  purged daily; Firestore has delete protection and 7-day point-in-time recovery.
- **Cost-bounded.** Functions are pinned to one region with 256 MiB, a 60-second timeout and a maximum of 10 instances,
  scaling to zero.

## Verification

- **468 automated test cases**: unit, component and integration tests, 34 security-rule tests on the emulator, and 31
  Playwright specs including real two-browser journeys and 146 visual baselines.
- **CI on every push and pull request** in three jobs, against the Firebase Emulator Suite only; CI holds no cloud credentials.
- **The deploy guards are tested themselves**, including tests that staging and production configuration cannot cross.
- **Monitoring as configuration**: log-based metrics for function errors, failed scheduled runs, callable rejections and
  App Check rejections, an uptime check, and alert policies.
