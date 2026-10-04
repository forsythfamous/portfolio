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
    "I'm a cloud infrastructure and DevOps engineer in Kraków. Most of my working time is spent on Azure: networking, identity and the pipelines that change them.",
    'Outside that, I harden systems end to end on Google Cloud and Firebase: data layers clients cannot write to, webhooks that are safe to redeliver, and deploys that refuse to run against the wrong project.',
    'When a tool I rely on is wrong, I fix it upstream. I write up what I learn on dev.to.',
  ],
  email: 'forsyth.azure@gmail.com',
  links: {
    github: 'https://github.com/forsythfamous',
    linkedin: 'https://www.linkedin.com/in/forsythazure',
    devto: 'https://dev.to/forsyth_famous_',
  },
};

// Credentials. `url` must be a public Microsoft Learn share link (the profile's
// credentials page is private); until one is provided the code renders as text.
export const credentials: { code: string; name: string; url?: string }[] = [
  { code: 'AZ-400', name: 'DevOps Engineer Expert' },
  { code: 'AZ-700', name: 'Azure Network Engineer Associate' },
  { code: 'AZ-104', name: 'Azure Administrator Associate' },
  { code: '9 Applied Skills', name: 'Microsoft Applied Skills' },
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
