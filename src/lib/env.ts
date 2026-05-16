// Simple environment variable loader (replaces Cloudflare env)
export function getEnv(key: string): string | undefined {
  return process.env[key];
}

export const env = {
  CF_GH_PAT_FluxPulseReleaseDashboard: process.env.CF_GH_PAT_FluxPulseReleaseDashboard || '',
};
