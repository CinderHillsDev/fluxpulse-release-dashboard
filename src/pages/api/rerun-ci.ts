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
    // Get the most recent run on main branch to determine the workflow file
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
      workflow_runs: Array<{ id: number; status: string; conclusion: string | null; name: string; path: string; html_url: string }>
    };

    if (!runsData.workflow_runs || runsData.workflow_runs.length === 0) {
      console.error(`No runs found for ${repo}`);
      return new Response(JSON.stringify({ ok: false, error: 'no_runs_found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const latestRun = runsData.workflow_runs[0];
    const workflowPath = latestRun.path;

    console.log(`[rerun-ci] Triggering fresh workflow for ${repo} (workflow: ${workflowPath})`);

    // Trigger a fresh workflow run via workflow_dispatch on main
    const dispatchRes = await fetch(
      `${GH_API}/repos/${GH_OWNER}/${repo}/actions/workflows/${workflowPath}/dispatches`,
      {
        method: 'POST',
        headers: getHeaders(env.CF_GH_PAT_FluxPulseReleaseDashboard),
        body: JSON.stringify({
          ref: 'main',
          inputs: {},
        }),
      }
    );

    if (!dispatchRes.ok) {
      const detail = await dispatchRes.text().catch(() => '');
      const code = dispatchRes.status === 403 ? 'dispatch_forbidden'
        : dispatchRes.status === 404 ? 'workflow_not_found'
        : dispatchRes.status === 422 ? 'dispatch_unprocessable'
        : 'dispatch_failed';
      console.error(`Dispatch failed ${dispatchRes.status} for ${repo}/${workflowPath}:`, detail);
      return new Response(JSON.stringify({ ok: false, error: code, repo }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Give GitHub ~2s to register the new run, then fetch its URL
    await new Promise((r) => setTimeout(r, 2000));
    let runUrl = `https://github.com/${GH_OWNER}/${repo}/actions`;
    try {
      const newRunsRes = await fetch(
        `${GH_API}/repos/${GH_OWNER}/${repo}/actions/workflows/${workflowPath}/runs?per_page=1`,
        { headers: getHeaders(env.CF_GH_PAT_FluxPulseReleaseDashboard) }
      );
      if (newRunsRes.ok) {
        const data = (await newRunsRes.json()) as { workflow_runs: { id: number; html_url: string }[] };
        const newRun = data.workflow_runs[0];
        if (newRun) runUrl = newRun.html_url;
      }
    } catch {
      // fall through to actions page link
    }

    console.log(`[rerun-ci] Successfully triggered fresh workflow for ${repo}`);

    return new Response(JSON.stringify({
      ok: true,
      repo,
      runUrl
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('rerun-ci error:', error);
    return new Response(JSON.stringify({ ok: false, error: 'dispatch_failed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
