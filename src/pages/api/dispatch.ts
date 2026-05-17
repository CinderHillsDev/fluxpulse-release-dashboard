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

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  console.log('[dispatch] POST request received');
  console.log('[dispatch] Method:', request.method);
  console.log('[dispatch] Headers:', Object.fromEntries(request.headers));

  if (!env) {
    return new Response(JSON.stringify({ error: 'Environment not available' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const formData = await request.formData().catch((err) => {
    console.log('[dispatch] formData error:', err);
    return null;
  });
  if (!formData) {
    return new Response(JSON.stringify({ error: 'Invalid form data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log('[dispatch] formData entries:', Array.from(formData.entries()));

  const repo = String(formData.get('repo') ?? '');
  // 'bump' kept in form schema for backward compat but unused — none of
  // the app repos have a release.yml that bumps semver. Drop later.
  const workflow = String(formData.get('workflow') ?? 'release');

  if (!repo) {
    return new Response(JSON.stringify({ error: 'Missing repo' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const referer = request.headers.get('Referer');
    // "Release" button → dispatch deploy-uat.yml (the UAT promotion workflow
    // each repo already owns). "Deploy Prod" button → dispatch deploy-prod.yml.
    // No release.yml — semver bumping isn't part of the model.
    // Exception: fluxpulse-infrastructure uses single deploy.yml with 'env' input.
    const isRelease = workflow !== 'deploy-prod';
    const isProd = workflow === 'deploy-prod';

    // Infrastructure uses deploy.yml with env input; other repos use deploy-uat/deploy-prod
    const isInfra = repo === 'fluxpulse-infrastructure';
    const workflowFile = isInfra ? 'deploy.yml' : (isRelease ? 'deploy-uat.yml' : 'deploy-prod.yml');
    const inputs: Record<string, string> = isInfra ? { env: isProd ? 'prod' : 'uat' } : {};

    // Trigger workflow_dispatch
    const dispatchRes = await fetch(
      `${GH_API}/repos/${GH_OWNER}/${repo}/actions/workflows/${workflowFile}/dispatches`,
      {
        method: 'POST',
        headers: getHeaders(env.CF_GH_PAT_FluxPulseReleaseDashboard),
        body: JSON.stringify({
          ref: 'main',
          inputs,
        }),
      }
    );

    const redirectBase = referer ? new URL(referer).pathname : '/';

    if (!dispatchRes.ok) {
      const detail = await dispatchRes.text().catch(() => '');
      const code = dispatchRes.status === 403 ? 'dispatch_forbidden'
        : dispatchRes.status === 422 ? 'dispatch_unprocessable'
        : 'dispatch_failed';
      console.error(`dispatch failed ${dispatchRes.status} for ${repo}/${workflowFile}:`, detail);
      return new Response(JSON.stringify({ ok: false, error: code, repo }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Give GitHub ~2s to register the new run, then fetch its ID for a direct link.
    await new Promise((r) => setTimeout(r, 2000));
    let runUrl = `https://github.com/${GH_OWNER}/${repo}/actions/workflows/${workflowFile}`;
    try {
      const runsRes = await fetch(
        `${GH_API}/repos/${GH_OWNER}/${repo}/actions/workflows/${workflowFile}/runs?per_page=1`,
        { headers: getHeaders(env.CF_GH_PAT_FluxPulseReleaseDashboard) }
      );
      if (runsRes.ok) {
        const data = (await runsRes.json()) as { workflow_runs: { id: number; html_url: string }[] };
        const latestRun = data.workflow_runs[0];
        if (latestRun) runUrl = latestRun.html_url;
      }
    } catch {
      // fall through to workflow page link
    }

    return new Response(JSON.stringify({ ok: true, repo, runUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('dispatch error:', error);
    return new Response(JSON.stringify({ ok: false, error: 'dispatch_failed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
