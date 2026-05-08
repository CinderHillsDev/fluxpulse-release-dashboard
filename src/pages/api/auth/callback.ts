import type { APIRoute } from 'astro';
import { env as cfEnv } from 'cloudflare:workers';

const env = cfEnv as any as Env;
const ORG = 'CinderHillsDev';
const SESSION_TTL = 28800;

export const prerender = false;

function errorRedirect(origin: string, reason: string): Response {
  return Response.redirect(
    `${origin}/auth/error?reason=${encodeURIComponent(reason)}`,
    302
  );
}

function getHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'fluxpulse-release-dashboard',
  };
}

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const storedState = cookies.get('oauth_state')?.value;

    if (!code || !state || state !== storedState) {
      return errorRedirect(url.origin, 'invalid_state');
    }

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

    if (tokenRes.status === 403 || tokenRes.status === 429) {
      return errorRedirect(url.origin, 'github_rate_limited');
    }

    const tokenData = (await tokenRes.json()) as any;
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('Token exchange failed:', tokenData);
      return errorRedirect(url.origin, 'token_exchange_failed');
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: getHeaders(accessToken),
    });

    if (!userRes.ok) {
      const errorText = await userRes.text();
      console.error('User fetch failed:', userRes.status, errorText);
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

    const headers = new Headers({ Location: '/' });
    headers.append(
      'Set-Cookie',
      'oauth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'
    );
    headers.append(
      'Set-Cookie',
      `dashboard_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}`
    );
    return new Response(null, { status: 302, headers });
  } catch (err) {
    console.error('Callback error:', err);
    return errorRedirect(new URL(request.url).origin, 'callback_error');
  }
};
