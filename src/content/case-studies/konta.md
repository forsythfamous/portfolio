---
title: 'KONTA: hardening an AI business ledger for production'
summary: 'An AI-assisted ledger for small businesses, run from a web dashboard or WhatsApp, where AI proposes and deterministic code commits.'
order: 1
context: 'Product engineering · Google Cloud'
outcome: '100+ automated test files, 70+ merged pull requests, deny-all data layer'
stack: ['Google Cloud Run', 'Secret Manager', 'Firestore', 'Docker', 'TypeScript', 'Node.js', 'WhatsApp Cloud API', 'Gemini']
private: true
---

## The problem

Small merchants track sales, stock, debtors and expenses in notebooks and chat threads. KONTA lets them do it
from a WhatsApp text or voice note. That puts a language model directly in the path of a financial ledger,
which is a reliability and security problem before it is a product one.

## The core design decision

**AI proposes, people confirm, code commits.** A message is turned into a *proposal*. Nothing changes in the
books until a person confirms it, and the change itself is applied by deterministic, transactional code, never
by the model. The model can be wrong without the ledger being wrong.

## Platform

- Multi-stage Docker build with a non-root runtime user and a health check, deployed to **Google Cloud Run**.
- A least-privilege service account reads credentials from **Secret Manager**; nothing sensitive is baked into the image.
- **Firestore rules are deny-all.** The browser never talks to the database; every read and write goes through
  the server's Admin SDK, where validation and permissions live.

## Security hardening

- HMAC verification on the WhatsApp webhook; rate limiting on the web API; request body size limits.
- CSP, HSTS and frame-blocking response headers.
- Webhook-supplied identifiers are validated before they are used to build database paths.
- Phone numbers are masked in logs, and diagnostic logging was audited so customer financial data never lands in it.
- The production build was checked to make sure it never serves its own server source.

## Reliability

- Idempotent webhook processing, so a provider retry can never double-post a sale.
- Explicit timeouts on every AI and messaging call, with retry rules that are safe by construction:
  an outbound WhatsApp send is **never retried after a timeout**, because the message may already have been delivered.
- Durable inbound and outbound message logs, with the provider's asynchronous delivery-status webhook attached to the send log.
- Conversation state survives restarts.
- Ledger writes are transactional with per-business serialisation.

## Trade-off I chose deliberately

Ledger changes are serialised inside one process, and the ledger is cached in that process's memory. Two instances
could each act on a stale cache, so the service runs with **`--max-instances=1`** until those reads move inside
Firestore transactions. It is a documented constraint with a known exit path, not an accident waiting to happen.

## Engineering practice

- **100+ automated test files**, runnable against an in-memory database (about 30 seconds) or the real Firestore emulator.
- Tests refuse to touch a real cloud project: credentials are stripped from the environment, and Firestore mode is rejected unless it points at the emulator.
- Every change ships through a pull request: **70+ merged**.

*The source is private; this write-up describes the architecture and practices.*
