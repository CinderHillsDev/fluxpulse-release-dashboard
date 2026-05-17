import type { APIRoute } from 'astro';

// Global progress state shared between requests
declare global {
  var loadingProgress: { count: number; max: number };
}

if (!globalThis.loadingProgress) {
  globalThis.loadingProgress = { count: 0, max: 10 };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    if (data.action === 'increment') {
      globalThis.loadingProgress.count = Math.min(
        globalThis.loadingProgress.count + 1,
        globalThis.loadingProgress.max
      );
    } else if (data.action === 'reset') {
      globalThis.loadingProgress.count = 0;
    } else if (data.action === 'set') {
      globalThis.loadingProgress.count = data.count || 0;
      if (data.max) globalThis.loadingProgress.max = data.max;
    }
  } catch {
    // Silently handle JSON parse errors
  }

  return new Response(
    JSON.stringify({
      count: globalThis.loadingProgress.count,
      max: globalThis.loadingProgress.max,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      count: globalThis.loadingProgress.count,
      max: globalThis.loadingProgress.max,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
