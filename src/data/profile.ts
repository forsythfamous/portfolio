// Hand-maintained profile content. Every claim must be backed by a repository
// or a verifiable credential (see ~/career/evidence); no employer names.

export const profile = {
  name: 'Forsyth Famous',
  role: 'Cloud Infrastructure & DevOps Engineer',
  statement:
    'I build infrastructure that shows its own working: every change is proposed, gated, then committed. ' +
    'This site runs that way. The diagram is its pipeline, live.',
  meta: 'Kraków, Poland · Azure · Google Cloud · Firebase',
  about: [
    "I'm a cloud infrastructure and DevOps engineer in Kraków. I design for the failure cases first: the webhook that arrives twice, the deploy aimed at the wrong project, the model that gets something wrong.",
    "Azure is my home ground. On Google Cloud and Firebase I've hardened production-shaped systems: databases clients can't write to, retries that can't double-send, releases that check their own result.",
    'When a tool I depend on is wrong, I fix it upstream, and I write up what I learn as step-by-step guides.',
  ],
  email: 'forsyth.azure@gmail.com',
  links: {
    github: 'https://github.com/forsythfamous',
    linkedin: 'https://www.linkedin.com/in/forsythazure',
    devto: 'https://dev.to/forsyth_famous_',
  },
};

// Credentials, linked to Microsoft Learn share pages (verified 2026-10-05).
const learn = (id: string) => `https://learn.microsoft.com/api/credentials/share/en-us/Forsythfamous-3964/${id}?sharingId=AE41C8CE11434D50`;

export const certifications = [
  { code: 'AZ-400', name: 'DevOps Engineer Expert', url: learn('5BAAF193E17745D8') },
  { code: 'AZ-700', name: 'Azure Network Engineer Associate', url: learn('C1CC44551BE33731') },
  { code: 'AZ-104', name: 'Azure Administrator Associate', url: learn('DF92838DC9D2E7C0') },
];

export const appliedSkills = [
  { name: 'Configure secure access to your workloads using Azure networking', url: learn('5AC8EB7AB20FD728') },
  { name: 'Deploy and configure Azure Monitor', url: learn('64970AD0DDB23409') },
  { name: 'Secure storage for Azure Files and Azure Blob Storage', url: learn('D2AA4099D50AE689') },
  { name: 'Get started with identities and access using Microsoft Entra', url: learn('770CE074C6822AA9') },
  { name: 'Get started with Azure management tasks', url: learn('B80F55F3470B0214') },
  { name: 'Get started with cloud security and monitoring tasks', url: learn('871FEFDE3CFDE403') },
  { name: 'Administer Active Directory Domain Services', url: learn('CBD217E553C8EAAA') },
  { name: 'Create and manage automated processes by using Power Automate', url: learn('D0D21E1EBAEEE09F') },
  { name: 'Implement retention, eDiscovery, and Communication Compliance in Microsoft Purview', url: learn('3BAE18873CAA3DD') },
];

// Propose · Gate · Commit: the method, with where each part is evidenced.
export const method = [
  {
    step: 'Propose',
    text: 'Anything that wants to change the system produces a proposal, never the change itself: a model drafting a ledger entry, an agent drafting a case study, a release tag asking to go to production.',
    evidence: { label: 'KONTA: the model drafts, never writes', href: '/work/konta#d-01' },
  },
  {
    step: 'Gate',
    text: 'A person or a check that cannot be skipped decides: a confirmation, a reviewed pull request, a deploy script that refuses the wrong project or an untagged commit.',
    evidence: { label: 'JahUs: guarded production deploys', href: '/work/jahus#d-02' },
  },
  {
    step: 'Commit',
    text: 'Only deterministic code applies an approved change, atomically and idempotently, and the result is verified afterwards rather than assumed.',
    evidence: { label: 'This site: agent drafts merge by PR', href: '/work/this-site#d-04' },
  },
];
