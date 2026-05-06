export async function onRequest(context) {
  const { request, env } = context;

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/callback`;

  // Generate CSRF state token
  const stateBytes = new Uint8Array(16);
  crypto.getRandomValues(stateBytes);
  const state = Array.from(stateBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Store state in KV for 10 minutes (single-use, CSRF protection)
  await env.CACHE.put(`oauth_state:${state}`, '1', { expirationTtl: 600 });

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'read:org',
    state,
  });

  return Response.redirect(
    `https://github.com/login/oauth/authorize?${params}`,
    302
  );
}
