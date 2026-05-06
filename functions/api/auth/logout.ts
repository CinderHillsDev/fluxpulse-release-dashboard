export async function onRequest(context) {
  const { request, env } = context;

  const authHeader = request.headers.get('Authorization');
  const sessionId = authHeader?.replace('Bearer ', '').trim();

  if (sessionId) {
    await env.CACHE.delete(`session:${sessionId}`);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
