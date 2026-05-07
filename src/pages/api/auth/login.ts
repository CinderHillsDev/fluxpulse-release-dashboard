import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const env = (locals as any).runtime?.env;
  if (!env?.CACHE) {
    return new Response('KV binding not available', { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/callback`;

  const stateBytes = new Uint8Array(16);
  crypto.getRandomValues(stateBytes);
  const state = Array.from(stateBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  await env.CACHE.put(`oauth_state:${state}`, '1', { expirationTtl: 600 });

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'read:org',
    state,
  });

  return Response.redirect(`https://github.com/login/oauth/authorize?${params}`, 302);
};
