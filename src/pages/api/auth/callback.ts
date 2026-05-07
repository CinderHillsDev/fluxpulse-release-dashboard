import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

const ORG = 'CinderHillsDev';
const SESSION_TTL = 28800;

function errorRedirect(origin: string, reason: string): Response {
  return Response.redirect(`${origin}/?auth_error=${reason}`, 302);
}

function getHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  
  if (!env?.GITHUB_CLIENT_ID || !env?.GITHUB_CLIENT_SECRET || !env?.GITHUB_TOKEN || !env?.SESSION) {
    return errorRedirect(new URL(request.url).origin, 'env_not_configured');
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return errorRedirect(url.origin, 'missing_code');
  }

  if (!state) {
    return errorRedirect(url.origin, 'missing_state');
  }

  const stateValid = await env.SESSION.get(`oauth_state:${state}`);
  if (!stateValid) {
    return errorRedirect(url.origin, 'invalid_state');
  }

  await env.SESSION.delete(`oauth_state:${state}`);

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/api/auth/callback`,
    }),
  });

  const tokenData = (await tokenRes.json()) as any;
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    return errorRedirect(url.origin, 'token_exchange_failed');
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: getHeaders(accessToken),
  });

  if (!userRes.ok) {
    return errorRedirect(url.origin, 'user_fetch_failed');
  }

  const user = (await userRes.json()) as any;

  const memberRes = await fetch(
    `https://api.github.com/orgs/${ORG}/members/${user.login}`,
    {
      headers: getHeaders(env.GITHUB_TOKEN),
    }
  );

  if (memberRes.status !== 204) {
    return errorRedirect(url.origin, 'not_org_member');
  }

  const sessionBytes = new Uint8Array(32);
  crypto.getRandomValues(sessionBytes);
  const sessionId = Array.from(sessionBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const sessionData = {
    githubLogin: user.login,
    githubId: user.id,
    createdAt: Date.now(),
  };

  await env.SESSION.put(`session:${sessionId}`, JSON.stringify(sessionData), {
    expirationTtl: SESSION_TTL,
  });

  const cookieVal = `dashboard_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': cookieVal,
    },
  });
};
