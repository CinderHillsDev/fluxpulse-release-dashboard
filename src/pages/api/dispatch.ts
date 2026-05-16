import type { APIRoute } from 'astro';
import { env as cfEnv } from 'cloudflare:workers';

const env = cfEnv as any as Env;
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
  
  if (!env) {
    return new Response(JSON.stringify({ error: 'Environment not available' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return new Response(JSON.stringify({ error: 'Invalid form data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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
    const isRelease = workflow !== 'deploy-prod';
    const workflowFile = isRelease ? 'deploy-uat.yml' : 'deploy-prod.yml';
    const inputs: Record<string, string> = {};

    // Trigger workflow_dispatch
    const dispatchRes = await fetch(
      `${GH_API}/repos/${GH_OWNER}/${repo}/actions/workflows/${workflowFile}/dispatches`,
      {
        method: 'POST',
        headers: getHeaders(env.GITHUB_TOKEN),
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
      return new Response(null, {
        status: 302,
        headers: { Location: `${redirectBase}?dispatch_error=${code}&repo=${encodeURIComponent(repo)}` },
      });
    }

    return new Response(null, {
      status: 302,
      headers: { Location: `${redirectBase}?dispatch_ok=${encodeURIComponent(repo)}` },
    });
  } catch (error) {
    const redirectBase = request.headers.get('Referer')
      ? new URL(request.headers.get('Referer')!).pathname
      : '/';
    console.error('dispatch error:', error);
    return new Response(null, {
      status: 302,
      headers: { Location: `${redirectBase}?dispatch_error=dispatch_failed` },
    });
  }
};
