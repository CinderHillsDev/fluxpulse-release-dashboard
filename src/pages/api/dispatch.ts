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
  const bump = String(formData.get('bump') ?? 'patch');

  if (!repo) {
    return new Response(JSON.stringify({ error: 'Missing repo' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const referer = request.headers.get('Referer');
    const inputs = {
      bump_type: bump === 'minor' ? 'minor' : 'patch',
    };

    // Trigger workflow_dispatch
    const dispatchRes = await fetch(
      `${GH_API}/repos/${GH_OWNER}/${repo}/actions/workflows/release.yml/dispatches`,
      {
        method: 'POST',
        headers: getHeaders(env.GITHUB_TOKEN),
        body: JSON.stringify({
          ref: 'main',
          inputs,
        }),
      }
    );

    if (!dispatchRes.ok) {
      return new Response(JSON.stringify({ error: 'Failed to dispatch workflow' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: referer || '/',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
