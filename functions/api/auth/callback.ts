const ORG = 'CinderHillsDev';
const SESSION_TTL = 28800; // 8 hours

function errorRedirect(origin: string, reason: string): Response {
  return Response.redirect(`${origin}/?auth_error=${reason}`, 302);
}

export async function onRequest(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // Validate state (CSRF protection)
  if (!state) {
    return errorRedirect(url.origin, 'missing_state');
  }
  const storedState = await env.CACHE.get(`oauth_state:${state}`);
  if (!storedState) {
    return errorRedirect(url.origin, 'invalid_state');
  }
  // State is single-use
  await env.CACHE.delete(`oauth_state:${state}`);

  if (!code) {
    return errorRedirect(url.origin, 'missing_code');
  }

  // Exchange code for GitHub access token
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

  // Fetch the authenticated user's identity
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!userRes.ok) {
    return errorRedirect(url.origin, 'user_fetch_failed');
  }
  const user = (await userRes.json()) as any;

  // Check org membership using the server-side PAT (GITHUB_TOKEN)
  const memberRes = await fetch(
    `https://api.github.com/orgs/${ORG}/members/${user.login}`,
    {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );
  // 204 = member, 302/404 = not a member
  if (memberRes.status !== 204) {
    return errorRedirect(url.origin, 'not_org_member');
  }

  // Generate session ID (do NOT store the GitHub access token)
  const sessionBytes = new Uint8Array(32);
  crypto.getRandomValues(sessionBytes);
  const sessionId = Array.from(sessionBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  await env.CACHE.put(
    `session:${sessionId}`,
    JSON.stringify({
      githubLogin: user.login,
      githubId: user.id,
      createdAt: Date.now(),
    }),
    { expirationTtl: SESSION_TTL }
  );

  // Redirect to SPA with session ID as query param
  return Response.redirect(`${url.origin}/?session=${sessionId}`, 302);
}
