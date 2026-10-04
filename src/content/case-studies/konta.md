---
title: 'KONTA: a ledger a language model cannot corrupt'
summary: 'An AI-assisted business ledger for small merchants, used from a web dashboard and from WhatsApp, hardened so that money only moves through confirmed, idempotent, deterministic code.'
order: 1
role: 'Security, reliability and deployment hardening'
period: 'Sep 2026'
status: 'Private · Cloud Run, single instance'
source: 'private'
stack: ['Cloud Run', 'Firestore', 'Secret Manager', 'Cloud Scheduler', 'Firebase Auth', 'Node.js', 'Express', 'TypeScript', 'Docker', 'WhatsApp Cloud API', 'Gemini']
diagram: 'konta'
core: 'The model proposes, a person confirms, deterministic code commits.'
tldr:
  problem: 'Small merchants keep their books in notebooks and chat threads. Putting a language model and WhatsApp in front of a financial ledger makes correctness and security the actual product.'
  decision: 'Nothing a model produces is ever written. It becomes a proposal that a person confirms, and deterministic, idempotent code applies it.'
  result: 'One service is the only path to the data, every external call is bounded, and redelivered webhooks, double taps and timeouts are handled by design and covered by tests.'
decisions:
  - title: 'The model drafts; it never writes'
    decision: 'Gemini output, or a deterministic parser when Gemini fails, becomes a proposal in PENDING_CONFIRMATION. Only an explicit confirmation runs the Action Engine, which re-validates role, expiry, stock and debt limits before writing.'
    options:
      - 'Let the model call write tools directly: simplest, and one hallucination away from a wrong balance.'
      - 'Proposal, confirmation, deterministic execution: one extra tap per entry.'
    tradeoff: 'Every entry needs a confirmation, and parsing logic exists twice (model and deterministic paths). In exchange, the books cannot be changed by a model error, and AI-written debt reminders are discarded unless they state the real amount.'
    evidence:
      - { label: 'server/nlpOrchestrator.ts' }
      - { label: 'server/actionEngine.ts' }
      - { label: 'PR #1' }
  - title: 'Deny-all database rules, server-only access'
    decision: 'Firestore rules deny every client read and write. All access goes through the API with the Admin SDK, after verifying the Firebase ID token and an active membership for the business named in the request; owner, manager and cashier roles are enforced per route.'
    options:
      - 'Rules-based client access using membership documents: realtime listeners, but membership documents a client can write would let any signed-in user grant themselves access to any business.'
      - 'Server-only access: one place to enforce tenancy and roles.'
    tradeoff: 'No client-side realtime listeners; every read is an API round trip.'
    evidence:
      - { label: 'firestore.rules' }
      - { label: 'server/authMiddleware.ts' }
      - { label: 'PR #1' }
  - title: 'Never retry a send after a timeout'
    decision: 'Outbound WhatsApp sends have a 10-second timeout and one retry, but only for pre-send network errors, 429 and 5xx. A client-side timeout is terminal.'
    options:
      - 'Retry on any failure: maximises delivery, and can message a customer twice, because the send API has no idempotency key.'
      - 'Treat timeouts as ambiguous and do not retry.'
    tradeoff: 'Some timed-out sends are lost rather than duplicated. Delivery is then diagnosed from a durable send log that the asynchronous status webhook is merged into.'
    evidence:
      - { label: 'server/whatsapp/provider.ts' }
      - { label: 'PR #60' }
      - { label: 'PR #65' }
      - { label: 'PR #68' }
  - title: 'Idempotency at both ends'
    decision: 'Inbound messages are claimed by message id in a Firestore transaction with a 45-second lease, released on a crash so the redelivery can succeed. Confirmed actions take a fenced execution claim, and an execution record is written in the same batch as the ledger change, so a replay returns the stored result.'
    options:
      - 'Best-effort de-duplication in memory: lost on restart.'
      - 'Durable claims at the message and action level.'
    tradeoff: 'More transactions per message and a state machine with more states to test.'
    evidence:
      - { label: 'server/whatsapp/idempotencyStore.ts' }
      - { label: 'server/actionEngine.ts' }
      - { label: 'server/saleTransactionEngine.ts' }
  - title: 'One instance, deliberately'
    decision: 'Run exactly one Cloud Run instance. Each business''s ledger is cached in memory behind a per-business lock; Firestore is committed first and memory updated after, and the process exits on an uncaught exception rather than serve a half-applied cache.'
    options:
      - 'Scale horizontally now: needs every read inside a transaction first.'
      - 'Single instance with a documented exit path.'
    tradeoff: 'No horizontal scaling or instance-level redundancy; a deploy briefly interrupts service, softened by a 10-second SIGTERM drain and conversation state that resumes from Firestore.'
    exit: 'Move ledger reads into Firestore transactions, then lift the instance cap.'
    evidence:
      - { label: 'server/store.ts' }
      - { label: 'docs/DEPLOY.md' }
      - { label: 'PR #3' }
      - { label: 'PR #61' }
failures:
  - { failure: 'Meta redelivers a webhook', detection: 'Same message id already claimed', mitigation: 'Acknowledged without reprocessing', evidence: 'idempotencyStore.ts' }
  - { failure: 'User taps Confirm twice', detection: 'Second claim on the same action', mitigation: 'Fenced claim; replay returns the stored result', evidence: 'executionClaimFencingIsolation.test.ts' }
  - { failure: 'A send times out', detection: 'Client-side timeout', mitigation: 'Not retried; status webhook reconciles delivery', evidence: 'PR #65, PR #68' }
  - { failure: 'Gemini is slow or down', detection: '12-second timeout', mitigation: 'Deterministic parsing and synthesis', evidence: 'PR #59' }
  - { failure: 'Crash during a request', detection: 'uncaughtException', mitigation: 'Exit; the database is always ahead of memory', evidence: 'server.ts' }
  - { failure: 'Redeploy mid-conversation', detection: 'SIGTERM', mitigation: 'Drain, then resume state from Firestore', evidence: 'PR #61' }
  - { failure: 'A test that never runs', detection: 'Exit codes ignored', mitigation: 'Audited; nine silent passes fixed', evidence: 'PR #43' }
next:
  - 'Run the test suite as a required check on every pull request and deploy from CI; today deploys are a manual Cloud Run source deploy.'
  - 'Move ledger reads inside Firestore transactions and lift the single-instance cap.'
  - 'Key the general API rate limiter by user after authentication, not by IP.'
  - 'Apply the message-log consent gate and a retention TTL to the raw inbound webhook log.'
  - 'Make the once-a-day summary guard a transactional create instead of read-then-send.'
updated: '2026-10-05'
---

## Context and constraints

Merchants record sales, orders, stock, debtors and expenses by sending a WhatsApp text or voice note, or from a web
dashboard. Three things were non-negotiable:

- **Money is never double-posted**, however many times a provider redelivers a webhook or a user taps a button.
- **A model never writes to the ledger.** It is useful for understanding a message, not for being trusted with a balance.
- **Tenants are isolated.** Profit, cost and expense figures are owner-only by default and redacted server-side for staff.

Every external call is bounded so the synchronous webhook path always answers: Gemini at 12 seconds, sends at 10 seconds per
attempt, voice notes capped at 5 MB, inbound text at 4,096 characters, request bodies at 1 MB.

## Security posture

- The webhook verifies an HMAC-SHA256 signature over the raw request bytes with a constant-time comparison, and fails closed.
- Webhook-supplied identifiers are validated before they are used in database paths (PR #71).
- Rate limits on the API, a stricter limit on model-backed routes, and a per-phone limit on WhatsApp.
- Strict CSP, HSTS and frame-blocking headers in production; the static server exposes only the client build (PR #49).
- Phone numbers are masked in logs; linking tokens come from a cryptographic random source (PR #51, PR #57).
- A two-stage, non-root container image with a health check; secrets in Secret Manager behind a dedicated service account.

## Verification

- **72 merged pull requests**, each carrying its own rationale.
- **98 test files** run by a custom runner that executes each file in its own process, strips cloud credentials from the
  environment and refuses to use Firestore unless it points at the emulator; the same suite runs against the emulator.
- Suites target concurrency and isolation directly: claim fencing, proposal concurrency, cross-tenant isolation, end-to-end webhooks, HMAC.
- The tests themselves were audited: nine files that always reported a pass were found and fixed (PR #43).
