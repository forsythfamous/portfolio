---
title: 'Azure hub-spoke: private by default, changed only through review'
summary: 'A Terraform reference implementation of an Azure hub-spoke network: storage reachable only through a private endpoint, a WAF in Prevention mode in front of the workload, and a pipeline that applies nothing unless the plan matches the one a reviewer approved.'
order: 2
role: 'Architecture, Terraform and delivery pipeline'
period: 'Oct 2026'
status: 'Public reference implementation'
source: 'https://github.com/forsythfamous/azure-hub-spoke'
stack: ['Terraform', 'azurerm 4.x', 'Virtual Network', 'Private Endpoints', 'Private DNS', 'Application Gateway WAF_v2', 'Azure Firewall', 'Log Analytics', 'GitHub Actions', 'OIDC', 'tflint', 'trivy']
diagram: 'azure'
core: 'Nothing is applied unless a fresh plan matches the one a reviewer approved.'
tldr:
  problem: 'Data services reachable on public endpoints, spokes that can talk to each other by accident, and infrastructure changes reviewed as code diffs rather than as what will actually change.'
  decision: 'Private endpoints with centrally hosted DNS, a WAF in Prevention mode, isolation as the default, and a pipeline in which apply runs only after approval and only if the plan has not changed since.'
  result: 'Storage has no public path, spokes cannot reach each other unless an explicit firewall rule allows it, pull requests only ever get read-only credentials, and formatting, validation, lint, a security scan and mocked plan tests run on every change.'
decisions:
  - title: 'Customer-managed hub-spoke over Virtual WAN'
    decision: 'A hub VNet peered to each spoke. Every routing decision is a visible Terraform resource: peerings, route tables, firewall rules.'
    options:
      - 'Virtual WAN with a secured hub: less plumbing, an hourly hub charge before any firewall, and less control over routing.'
      - 'Customer-managed hub: reviewable in a pull request and close to zero idle cost.'
    tradeoff: 'Spoke-to-spoke transit has to be designed explicitly, and peerings and DNS links grow with the number of spokes.'
    exit: 'At tens of spokes, several regions or heavy branch connectivity, revisit Virtual WAN or Azure Virtual Network Manager.'
    evidence:
      - { label: 'ADR-0001', url: 'https://github.com/forsythfamous/azure-hub-spoke/blob/main/docs/adr/0001-hub-spoke-over-virtual-wan.md' }
      - { label: 'modules/hub', url: 'https://github.com/forsythfamous/azure-hub-spoke/blob/main/modules/hub/main.tf' }
  - title: 'The firewall is optional; isolation is the default'
    decision: 'Azure Firewall sits behind a variable that defaults to off. Its subnets always exist, so the address plan never changes. Without it, peering is non-transitive and the spokes have no path to each other; with it, one application rule allows only the storage account''s blob FQDN.'
    options:
      - 'Always deploy the firewall: about three times the cost of everything else combined.'
      - 'Make it optional and keep the no-firewall state secure.'
    tradeoff: 'With the firewall off, the workload tier cannot reach the data spoke at all, by design.'
    evidence:
      - { label: 'ADR-0002', url: 'https://github.com/forsythfamous/azure-hub-spoke/blob/main/docs/adr/0002-azure-firewall-optional.md' }
      - { label: 'modules/hub/firewall.tf', url: 'https://github.com/forsythfamous/azure-hub-spoke/blob/main/modules/hub/firewall.tf' }
      - { label: 'envs/dev/tests/plan.tftest.hcl', url: 'https://github.com/forsythfamous/azure-hub-spoke/blob/main/envs/dev/tests/plan.tftest.hcl' }
  - title: 'Private endpoints with centrally hosted DNS'
    decision: 'The storage account has public network access and shared keys disabled and is reachable only through a private endpoint. privatelink zones live once in the hub and every VNet links to them; the endpoint registers its own record through a DNS zone group.'
    options:
      - 'Service endpoints: keep the public endpoint and filter by subnet.'
      - 'Private endpoints: a private IP, provided every client resolves to it.'
    tradeoff: 'Clients outside the linked VNets cannot reach the service at all, which is the point; DNS becomes part of the network design.'
    evidence:
      - { label: 'ADR-0003', url: 'https://github.com/forsythfamous/azure-hub-spoke/blob/main/docs/adr/0003-private-endpoints-and-private-dns.md' }
      - { label: 'modules/private-endpoint', url: 'https://github.com/forsythfamous/azure-hub-spoke/blob/main/modules/private-endpoint/main.tf' }
      - { label: 'modules/hub/dns.tf', url: 'https://github.com/forsythfamous/azure-hub-spoke/blob/main/modules/hub/dns.tf' }
  - title: 'WAF in Prevention mode, with custom rules first'
    decision: 'Application Gateway WAF_v2 with Microsoft Default Rule Set 2.1 and the bot manager rules, in Prevention mode. Two custom rules run first: admin paths blocked unless the client is allowlisted, and a per-client-IP rate limit. Authorization headers and cookies are scrubbed from WAF logs.'
    options:
      - 'Start in Detection mode: nothing breaks, and attacks become unread log lines.'
      - 'Start in Prevention: false positives surface as blocked requests and get tuned.'
    tradeoff: 'Legitimate requests can be blocked until exclusions are tuned; every WAF block, including rate limiting, returns 403.'
    evidence:
      - { label: 'ADR-0004', url: 'https://github.com/forsythfamous/azure-hub-spoke/blob/main/docs/adr/0004-waf-prevention-mode-with-custom-rules.md' }
      - { label: 'modules/app-gateway-waf/waf-policy.tf', url: 'https://github.com/forsythfamous/azure-hub-spoke/blob/main/modules/app-gateway-waf/waf-policy.tf' }
  - title: 'OIDC with two identities, no secrets'
    decision: 'GitHub Actions authenticates through workload identity federation. A plan identity (Reader) serves pull requests; an apply identity (Contributor) is only available to jobs inside the protected production environment.'
    options:
      - 'One service principal with a client secret: simple, long-lived, and leaks through logs and forks.'
      - 'Federated credentials scoped by subject.'
    tradeoff: 'More setup per environment; in exchange, a compromised branch can only ever obtain a read-only token.'
    evidence:
      - { label: 'ADR-0005', url: 'https://github.com/forsythfamous/azure-hub-spoke/blob/main/docs/adr/0005-oidc-federated-credentials.md' }
      - { label: 'docs/deployment-identity.md', url: 'https://github.com/forsythfamous/azure-hub-spoke/blob/main/docs/deployment-identity.md' }
  - title: 'Approval covers the exact change'
    decision: 'Pull requests run fmt, validate, tflint, trivy and a speculative plan. On main, a fresh plan is published with a SHA-256 fingerprint of the planned changes; after a reviewer approves the production environment, the job re-plans under a lock and applies only if the fingerprint still matches.'
    options:
      - 'Pass the plan file between jobs: plan files can hold sensitive values, and artifacts on a public repository are readable.'
      - 'Re-plan and compare fingerprints.'
    tradeoff: 'Any drift between approval and apply fails the run and needs a new review.'
    evidence:
      - { label: 'ADR-0006', url: 'https://github.com/forsythfamous/azure-hub-spoke/blob/main/docs/adr/0006-plan-on-pr-apply-behind-approval.md' }
      - { label: '.github/workflows/apply.yml', url: 'https://github.com/forsythfamous/azure-hub-spoke/blob/main/.github/workflows/apply.yml' }
      - { label: '.github/workflows/propose.yml', url: 'https://github.com/forsythfamous/azure-hub-spoke/blob/main/.github/workflows/propose.yml' }
failures:
  - { failure: 'Plan changes after approval', detection: 'Fingerprint mismatch on re-plan', mitigation: 'Apply refused; review again', evidence: 'apply.yml' }
  - { failure: 'Compromised pull request branch', detection: 'OIDC subject is pull_request', mitigation: 'Only the read-only identity is issued', evidence: 'ADR-0005' }
  - { failure: 'Storage reached from the Internet', detection: 'Public network access disabled', mitigation: 'Rejected by the service', evidence: 'plan.tftest.hcl' }
  - { failure: 'Insecure configuration merged', detection: 'tflint and trivy on every pull request', mitigation: 'Pull request fails', evidence: 'propose.yml' }
  - { failure: 'Spoke-to-spoke access', detection: 'Non-transitive peering', mitigation: 'Only an explicit firewall rule allows it', evidence: 'ADR-0002' }
  - { failure: 'Runaway cost', detection: 'Budget per resource group', mitigation: 'Alerts; daily log cap of 1 GB', evidence: 'envs/dev/cost.tf' }
next:
  - 'Add Azure Policy assignments as guardrails alongside the Terraform checks.'
  - 'Move to the azurerm 5.x provider line.'
  - 'Revisit Virtual WAN or Azure Virtual Network Manager if the number of spokes grows.'
updated: '2026-10-05'
---

## Context and constraints

The design answers three questions a reviewer would ask of any Azure landing network: can anything reach the data
from the Internet, can a workload reach something it should not, and can a change reach production without someone
seeing exactly what it will do.

- **Region and scope.** One region, two spokes (workload and data), no on-premises connectivity.
- **Cost-aware.** The expensive components, Azure Firewall and the WAF gateway, are the only significant costs; the
  firewall is optional, budgets are set per resource group and log ingestion is capped.
- **Nothing implicit.** Compute subnets have default outbound access disabled, the private endpoint subnet enforces its
  NSG, and every route exists as a resource.

## Verification

- **On every pull request:** `terraform fmt`, `terraform validate`, `tflint` with the azurerm ruleset, and a `trivy`
  misconfiguration scan with each accepted finding justified inline.
- **Mocked plan tests** (`terraform test`, no credentials needed) assert that the firewall is off by default, that
  only the app subnet routes through it when it is on, that the storage account has public access and shared keys
  disabled, that every resource group has a budget, and that invalid workload names are rejected.
- **docs/VERIFY.md** lists the commands that prove each property in a live subscription: peering state, private DNS
  resolution from inside the spokes, rejected public access, WAF blocks and rate limiting in the firewall logs.
