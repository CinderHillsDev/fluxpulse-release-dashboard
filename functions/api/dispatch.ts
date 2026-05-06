// Stub: Dispatch endpoint for triggering releases
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { repo, workflow, bump_type } = body;

    if (!repo || !workflow) {
      return new Response(
        JSON.stringify({ error: 'Missing repo or workflow' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // TODO: Implement actual dispatch to GitHub Actions
    // For now, just acknowledge
    return new Response(
      JSON.stringify({
        message: `Dispatch triggered for ${repo} (${bump_type || 'default'})`,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
