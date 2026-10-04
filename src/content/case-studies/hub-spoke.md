---
title: 'Private-by-default networking across 5 subscriptions'
summary: 'A hub-spoke network where platform services are reached over private endpoints instead of the public internet.'
order: 3
context: 'Large-scale enterprise environment · Azure'
outcome: 'Hub-spoke topology with private endpoints across 5 subscriptions'
stack: ['Azure Virtual Network', 'Hub-spoke', 'Private Endpoints', 'Azure Networking']
---

## The problem

Workloads spread across several subscriptions each had their own networking decisions, and platform services such
as storage were reachable over public endpoints. That makes the security boundary hard to reason about and
expensive to audit.

## What I did

- Designed a **hub-spoke** architecture spanning **5 Azure subscriptions**: shared connectivity and controls in the
  hub, workloads isolated in spokes.
- Moved access to PaaS services onto **private endpoints**, so traffic to them stays on the private network.

## Outcome

- One network model across all five subscriptions instead of five local decisions.
- Platform services are private by default, which shrinks the attack surface and simplifies audits.

*Client-specific details are generalised.*
