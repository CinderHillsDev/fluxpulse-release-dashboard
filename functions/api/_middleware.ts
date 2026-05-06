export async function onRequest(context) {
  const { request, env } = context;

  // Check Authorization header on all /api/* routes
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token || token !== env.DASHBOARD_TOKEN) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Pass the environment to the next handler
  return context.next();
}
