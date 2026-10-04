---
title: 'Environment provisioning: from 2 days to 30 minutes'
summary: 'Replacing hand-built virtual machines and Application Gateways with Terraform modules shipped through a CI/CD pipeline.'
order: 2
context: 'Large-scale enterprise environment · Azure'
outcome: 'Environment setup cut from 2 days to 30 minutes'
stack: ['Terraform', 'Azure', 'Application Gateway', 'WAF', 'CI/CD']
---

## The problem

New environments were assembled by hand: virtual machines, networking and an Application Gateway in front of the
workload. Each one took around **two days**, and no two came out quite the same. Drift between environments made
incidents harder to reproduce, and every manual step was a chance to miss a security setting.

## What I did

- Codified virtual machine and **Application Gateway** provisioning in **Terraform**, so an environment is a reviewed,
  version-controlled definition rather than a sequence of portal clicks.
- Ran the provisioning through a **CI/CD pipeline**, so changes go through review and are applied the same way every time.
- Put web workloads behind **Application Gateway WAF**, combining Microsoft-managed rule sets with custom rules and
  **rate limiting** to block malicious and abusive traffic.
- Put idle non-production virtual machines on deallocation and shutdown schedules, so that capacity is only paid for when it is used.

## Outcome

- Environment setup went from **2 days to 30 minutes**.
- Environments are reproducible from code, which makes drift visible and reviews meaningful.
- Edge protection is part of the definition, not a follow-up task.

*Client-specific details are generalised.*
