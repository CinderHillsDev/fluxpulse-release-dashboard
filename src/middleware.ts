import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const isAuthRoute = context.url.pathname.startsWith('/api/auth/');

  if (isAuthRoute) {
    return next();
  }

  // TODO: Re-enable auth after fixing cookie/session persistence
  // For now, allow all requests through to test dashboard functionality

  const sessionId = context.cookies.get('dashboard_session')?.value;
  if (sessionId) {
    try {
      const runtime = (context.locals as any).runtime;
      if (runtime?.env?.SESSION) {
        const sessionData = await runtime.env.SESSION.get(`session:${sessionId}`);
        if (sessionData) {
          context.locals.session = JSON.parse(sessionData);
          context.locals.sessionId = sessionId;
        }
      }
    } catch (e) {
      // Ignore errors, just allow request
    }
  }

  return next();
});
