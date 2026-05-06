export async function onRequest(context) {
  const { request, env } = context;

  const url = new URL(request.url);

  // Exempt auth routes from session validation
  if (url.pathname.startsWith('/api/auth/')) {
    return context.next();
  }

  // Check Authorization header on all other /api/* routes
  const authHeader = request.headers.get('Authorization');
  const sessionId = authHeader?.replace('Bearer ', '').trim();

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate session against KV
  const session = await env.CACHE.get(`session:${sessionId}`);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Attach session data to context for downstream handlers
  context.data.session = JSON.parse(session);

  // Pass to the next handler
  return context.next();
}
