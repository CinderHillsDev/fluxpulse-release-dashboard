import type { APIRoute } from 'astro';
import { env as cfEnv } from '@/lib/env';

const env = cfEnv as any;
const GH_API = 'https://api.github.com';
const GH_OWNER = 'CinderHillsDev';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData();
  const repos = formData.getAll('repos').map(String).filter(Boolean);
  const workflow = String(formData.get('workflow') ?? 'release');
  const workflowFile = workflow === 'deploy-prod' ? 'deploy-prod.yml' : 'deploy-uat.yml';

  const headers = {
    Authorization: `Bearer ${(env as any).CF_GH_PAT_FluxPulseReleaseDashboard}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'fluxpulse-release-dashboard',
    'Content-Type': 'application/json',
  };

  const results: Record<string, 'ok' | 'error'> = {};
  // Fire dispatches sequentially to avoid hitting GitHub rate limits
  for (const repo of repos) {
    const res = await fetch(
      `${GH_API}/repos/${GH_OWNER}/${repo}/actions/workflows/${workflowFile}/dispatches`,
      { method: 'POST', headers, body: JSON.stringify({ ref: 'main', inputs: {} }) }
    ).catch(() => null);
    results[repo] = res?.ok ? 'ok' : 'error';
  }

  const succeeded = Object.entries(results).filter(([, v]) => v === 'ok').map(([k]) => k);
  const failed = Object.entries(results).filter(([, v]) => v === 'error').map(([k]) => k);

  const referer = request.headers.get('Referer');
  const redirectBase = referer ? new URL(referer).pathname : '/';

  const params = new URLSearchParams();
  if (succeeded.length) params.set('batch_ok', succeeded.join(','));
  if (failed.length) params.set('batch_error', failed.join(','));

  return new Response(null, {
    status: 302,
    headers: { Location: `${redirectBase}?${params}` },
  });
};
