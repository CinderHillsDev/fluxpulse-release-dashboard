import type { APIRoute } from 'astro';
import { env as cfEnv } from '@/lib/env';

const env = cfEnv as any;

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const runUrl = url.searchParams.get('run_url');
  // runUrl looks like: https://github.com/CinderHillsDev/some-repo/actions/runs/12345678
  // Convert to API URL: https://api.github.com/repos/CinderHillsDev/some-repo/actions/runs/12345678
  if (!runUrl) return Response.json({ error: 'missing run_url' }, { status: 400 });

  try {
    const apiUrl = runUrl
      .replace('https://github.com/', 'https://api.github.com/repos/')
      .replace('/actions/runs/', '/actions/runs/');

    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${env.CF_GH_PAT_FluxPulseReleaseDashboard}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'fluxpulse-release-dashboard',
      },
    });
    if (!res.ok) return Response.json({ error: 'github api error', status: res.status }, { status: 502 });
    const run = await res.json() as any;
    return Response.json({
      status: run.status,         // queued | in_progress | completed
      conclusion: run.conclusion, // success | failure | cancelled | null
      html_url: run.html_url,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
