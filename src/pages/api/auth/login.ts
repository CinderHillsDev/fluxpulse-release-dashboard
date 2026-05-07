import type { APIRoute } from 'astro';
import { env as cfEnv } from 'cloudflare:workers';

export const prerender = false;

const env = cfEnv as any as Env;

export const GET: APIRoute = async ({ request }) => {
  if (!env?.GITHUB_CLIENT_ID || !env?.SESSION) {
    return new Response('Configuration error', { status: 500 });
  }

  const stateBytes = new Uint8Array(32);
  crypto.getRandomValues(stateBytes);
  const state = Array.from(stateBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  await env.SESSION.put(`oauth_state:${state}`, '1', { expirationTtl: 600 });

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'read:user read:org',
    state,
  });

  return Response.redirect(`https://github.com/login/oauth/authorize?${params}`, 302);
};
