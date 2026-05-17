import type { APIRoute } from 'astro';
import { env as cfEnv } from '@/lib/env';

const env = cfEnv as any;
const GH_API = 'https://api.github.com';
const GH_OWNER = 'CinderHillsDev';
const GH_API_VERSION = '2022-11-28';

function getHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GH_API_VERSION,
    'User-Agent': 'fluxpulse-release-dashboard',
  };
}

export const POST: APIRoute = async ({ request }) => {
  console.log('[rerun-ci] POST request received');

  if (!env) {
    return new Response(JSON.stringify({ error: 'Environment not available' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const formData = await request.formData().catch((err) => {
    console.log('[rerun-ci] formData error:', err);
    return null;
  });

  if (!formData) {
    return new Response(JSON.stringify({ error: 'Invalid form data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const repo = String(formData.get('repo') ?? '');

  if (!repo) {
    return new Response(JSON.stringify({ error: 'Missing repo' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get the most recent run on main branch
    const runsRes = await fetch(
      `${GH_API}/repos/${GH_OWNER}/${repo}/actions/runs?branch=main&per_page=1`,
      { headers: getHeaders(env.CF_GH_PAT_FluxPulseReleaseDashboard) }
    );

    if (!runsRes.ok) {
      console.error(`Failed to fetch runs for ${repo}: ${runsRes.status}`);
      return new Response(JSON.stringify({ ok: false, error: 'runs_fetch_failed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const runsData = (await runsRes.json()) as {
      workflow_runs: Array<{ id: number; status: string; conclusion: string | null; html_url: string }>
    };

    if (!runsData.workflow_runs || runsData.workflow_runs.length === 0) {
      console.error(`No runs found for ${repo}`);
      return new Response(JSON.stringify({ ok: false, error: 'no_runs_found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const latestRun = runsData.workflow_runs[0];
    const runId = latestRun.id;

    console.log(`[rerun-ci] Attempting to re-run ${repo} run ${runId} (status: ${latestRun.status}, conclusion: ${latestRun.conclusion})`);

    // Re-run the workflow
    const rerunRes = await fetch(
      `${GH_API}/repos/${GH_OWNER}/${repo}/actions/runs/${runId}/rerun`,
      {
        method: 'POST',
        headers: getHeaders(env.CF_GH_PAT_FluxPulseReleaseDashboard),
      }
    );

    if (!rerunRes.ok) {
      const detail = await rerunRes.text().catch(() => '');
      const code = rerunRes.status === 403 ? 'rerun_forbidden'
        : rerunRes.status === 404 ? 'run_not_found'
        : rerunRes.status === 422 ? 'rerun_unprocessable'
        : 'rerun_failed';
      console.error(`Rerun failed ${rerunRes.status} for ${repo}/${runId}:`, detail);
      return new Response(JSON.stringify({ ok: false, error: code, repo }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[rerun-ci] Successfully re-ran ${repo} run ${runId}`);

    return new Response(JSON.stringify({
      ok: true,
      repo,
      runUrl: latestRun.html_url,
      runId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('rerun-ci error:', error);
    return new Response(JSON.stringify({ ok: false, error: 'rerun_failed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
