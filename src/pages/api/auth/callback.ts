import type { APIRoute } from 'astro';
import { env as cfEnv } from 'cloudflare:workers';

const env = cfEnv as any as Env;
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

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    if (!env?.GITHUB_CLIENT_ID || !env?.GITHUB_CLIENT_SECRET || !env?.GITHUB_TOKEN || !env?.SESSION) {
      console.error('Missing env vars');
      return errorRedirect(new URL(request.url).origin, 'env_not_configured');
    }

    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    console.log('Callback received: code=', !!code, 'state=', !!state);

    if (!code) {
      console.error('Missing code');
      return errorRedirect(url.origin, 'missing_code');
    }

    if (!state) {
      console.error('Missing state');
      return errorRedirect(url.origin, 'missing_state');
    }

    const stateValid = await env.SESSION.get(`oauth_state:${state}`);
    console.log('State valid:', !!stateValid);
    if (!stateValid) {
      console.error('Invalid or expired state');
      return errorRedirect(url.origin, 'invalid_state');
    }

    // Delete state immediately to prevent reuse
    try {
      await env.SESSION.delete(`oauth_state:${state}`);
    } catch (e) {
      console.error('Failed to delete state:', e);
    }

    // Check for rate limit before making requests
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

    // Check for rate limit responses (403)
    if (tokenRes.status === 403) {
      console.error('GitHub rate limited');
      return errorRedirect(url.origin, 'github_rate_limited');
    }

    const tokenData = (await tokenRes.json()) as any;
    console.log('Token exchange response:', { status: tokenRes.status, hasToken: !!tokenData.access_token, error: tokenData.error });
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('No access token in response:', tokenData.error);
      return errorRedirect(url.origin, 'token_exchange_failed');
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: getHeaders(accessToken),
    });

    if (!userRes.ok) {
      console.error('User fetch failed:', userRes.status);
      return errorRedirect(url.origin, 'user_fetch_failed');
    }

    const user = (await userRes.json()) as any;
    console.log('User fetched:', user.login, 'id:', user.id);

    // TODO: Uncomment org membership check after testing
    // const memberRes = await fetch(
    //   `https://api.github.com/orgs/${ORG}/members/${user.login}`,
    //   {
    //     headers: getHeaders(env.GITHUB_TOKEN),
    //   }
    // );
    //
    // console.log('Org membership check:', memberRes.status, user.login);
    // if (memberRes.status !== 204) {
    //   console.error('Not org member:', memberRes.status);
    //   return errorRedirect(url.origin, 'not_org_member');
    // }

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

    console.log('Creating session:', sessionId);
    await env.SESSION.put(`session:${sessionId}`, JSON.stringify(sessionData), {
      expirationTtl: SESSION_TTL,
    });

    console.log('Setting session cookie:', sessionId);
    cookies.set('dashboard_session', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL,
    });

    console.log('Redirecting to home with session cookie');
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
      },
    });
  } catch (err) {
    console.error('Callback error:', err);
    return errorRedirect(new URL(request.url).origin, 'callback_error');
  }
};
