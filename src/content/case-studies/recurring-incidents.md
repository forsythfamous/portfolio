---
title: 'Eliminating a recurring failure behind ~10 incidents a month'
summary: 'Turning a repeat incident from something the on-call fixes every time into something nobody sees again.'
order: 4
context: 'Cloud operations · Azure & AWS'
outcome: '~10 incidents per month eliminated'
stack: ['Root-cause analysis', 'Azure Monitor', 'CloudWatch', 'Runbooks', 'ServiceNow']
---

## The problem

The same failure pattern was producing roughly **10 incidents a month**. Each one was handled correctly in isolation,
which is exactly why it kept coming back: the fix lived in individual engineers' heads, not in the system.

## What I did

- Grouped the incidents and traced them to a single **root cause** rather than treating them as separate tickets.
- Documented the permanent fix and the diagnostic path as a **runbook**.
- Shared it across the team so the fix was applied everywhere the pattern occurred, not just where it was last seen.

## Outcome

- The recurring incidents, **around 10 a month**, stopped.
- The runbook became part of the team's standard operating documentation.

## How I work incidents generally

Priority-1 incidents are handled inside **1–2 hour SLA** targets, with root-cause analysis and a permanent fix agreed
with engineering and security teams afterwards. Customer satisfaction across this work sits at **4.8–5 out of 5**.

*Client-specific details are generalised.*
