// Hand-maintained profile content. Claims must be backed by a repository;
// employer names are intentionally omitted.

export const profile = {
  name: 'Forsyth Famous',
  role: 'Cloud Infrastructure & DevOps Engineer',
  location: 'Kraków, Poland',
  headline: 'I design, automate and operate secure cloud platforms for large-scale enterprise environments.',
  intro:
    '6+ years across Azure and AWS: networking, identity and governance, Kubernetes, Terraform and CI/CD. ' +
    'I turn manual, error-prone operations into repeatable, auditable processes, and I document them so a team can run them without me.',
  email: 'forsyth.azure@gmail.com',
  links: {
    github: 'https://github.com/forsythfamous',
    linkedin: 'https://www.linkedin.com/in/forsythazure',
    devto: 'https://dev.to/forsyth_famous_',
    learn: 'https://learn.microsoft.com/en-us/users/forsythfamous-3964/credentials',
  },
};

// Outcome numbers are added only once a repository proves them (see ~/career/evidence).
export const stats: { value: string; label: string }[] = [];

export const certifications = [
  {
    code: 'AZ-400',
    name: 'DevOps Engineer Expert',
    issuer: 'Microsoft Certified',
    url: 'https://learn.microsoft.com/en-us/users/forsythfamous-3964/credentials',
  },
  {
    code: 'AZ-700',
    name: 'Azure Network Engineer Associate',
    issuer: 'Microsoft Certified',
    url: 'https://learn.microsoft.com/en-us/users/forsythfamous-3964/credentials/certification/azure-network-engineer-associate?tab=credentials-tab',
  },
  {
    code: 'AZ-104',
    name: 'Azure Administrator Associate',
    issuer: 'Microsoft Certified',
    url: 'https://learn.microsoft.com/en-us/users/forsythfamous-3964/credentials',
  },
];

export const appliedSkills = {
  count: 9,
  note: 'Microsoft Applied Skills credentials, including cloud security and monitoring.',
  url: 'https://learn.microsoft.com/en-us/users/forsythfamous-3964/credentials',
};

export const capabilities = [
  { area: 'Cloud platforms', items: 'Azure, AWS, Google Cloud Run' },
  { area: 'Networking', items: 'Hub-spoke, private endpoints, Application Gateway WAF, hybrid connectivity' },
  { area: 'Identity & governance', items: 'Entra ID, RBAC, IAM, policy, cost allocation tagging' },
  { area: 'Containers', items: 'AKS, EKS, Docker, Kubernetes operations' },
  { area: 'IaC & automation', items: 'Terraform, ARM, Ansible, Python, Bash, PowerShell' },
  { area: 'Delivery', items: 'GitHub Actions, Azure DevOps, PR-based change control' },
  { area: 'Observability', items: 'Azure Monitor, Prometheus, Grafana, Kibana, Splunk, CloudWatch' },
  { area: 'Operations', items: 'Incident response, RCA, DR readiness, runbooks, FinOps' },
];
