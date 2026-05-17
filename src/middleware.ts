import { defineMiddleware } from 'astro:middleware';

const DEV_CSRF_TOKEN = 'development-csrf-token-12345678';

export const onRequest = defineMiddleware(async (context, next) => {
  // For local development, use a fixed CSRF token
  context.cookies.set('astro.csrf', DEV_CSRF_TOKEN, {
    httpOnly: false,
    secure: false,
    sameSite: 'lax',
    path: '/',
  });
  context.locals.csrfToken = DEV_CSRF_TOKEN;

  // Show loading page on first visit to home page
  if (context.url.pathname === '/') {
    const hasVisited = context.cookies.has('visited');
    if (!hasVisited) {
      context.cookies.set('visited', 'true', {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
      });
      console.log('[middleware] Redirecting to /loading');
      return context.redirect('/loading');
    }
  }

  return next();
});
