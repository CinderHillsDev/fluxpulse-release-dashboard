export const GH_OWNER = 'CinderHillsDev';

export const REPOS = [
  'fluxpulse-platform',
  'fluxpulse-web',
  'fluxpulse-admin-web',
  'fluxpulse-status',
  'fluxpulse-public-website',
  'fluxpulse-docs',
  'fluxpulse-portal',
  'fluxpulse-agent-linux',
  'fluxpulse-agent-macos',
  'fluxpulse-agent-windows',
  'fluxpulse-health-checks',
  'fluxpulse-infrastructure',
  'fluxpulse-specs',
] as const;

export type RepoName = (typeof REPOS)[number];
