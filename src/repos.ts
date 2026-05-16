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

export const HEALTH_ENDPOINTS: Partial<Record<RepoName, { uat?: string; prod?: string }>> = {
  'fluxpulse-platform':      { uat: 'https://api-fp-uat.azurewebsites.net/health/ready',   prod: 'https://api-fp-prod.azurewebsites.net/health/ready' },
  'fluxpulse-portal':        { uat: 'https://portal.fluxpulse.dev',                         prod: 'https://portal.fluxpulse.app' },
  'fluxpulse-web':           { uat: 'https://app.fluxpulse.dev',                             prod: 'https://app.fluxpulse.app' },
  'fluxpulse-admin-web':     { uat: 'https://admin.fluxpulse.dev',                           prod: 'https://admin.fluxpulse.app' },
  'fluxpulse-status':        { uat: 'https://status.fluxpulse.dev',                          prod: 'https://status.fluxpulse.app' },
  'fluxpulse-public-website': { uat: 'https://fluxpulse.dev',                                prod: 'https://fluxpulse.app' },
  'fluxpulse-docs':          { uat: 'https://docs.fluxpulse.dev',                            prod: 'https://docs.fluxpulse.app' },
};
