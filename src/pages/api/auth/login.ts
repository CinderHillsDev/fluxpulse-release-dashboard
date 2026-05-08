import type { APIRoute } from 'astro';
import { env as cfEnv } from 'cloudflare:workers';

const env = cfEnv as any as Env;

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!env?.GITHUB_CLIENT_ID) {
    return new Response('Configuration error', { status: 500 });
  }

  const stateBytes = new Uint8Array(16);
  crypto.getRandomValues(stateBytes);
  const state = Array.from(stateBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const origin = new URL(request.url).origin;
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${origin}/api/auth/callback`,
    scope: 'read:user read:org',
    state,
  });

  const headers = new Headers({
    Location: `https://github.com/login/oauth/authorize?${params}`,
  });
  headers.append(
    'Set-Cookie',
    `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );

  return new Response(null, { status: 302, headers });
};
