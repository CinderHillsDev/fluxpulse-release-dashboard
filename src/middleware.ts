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

  // Show loading page briefly on home page visits
  // Skip loading page if coming from /loading, has _skip_loading param, or has any query params
  const referer = context.request.headers.get('referer') || '';
  const hasQueryParams = context.url.search.length > 0;
  const skipLoading = hasQueryParams || context.url.searchParams.has('_skip_loading') || referer.includes('/loading');
  if (context.url.pathname === '/' && !skipLoading) {
    return context.redirect('/loading');
  }

  return next();
});
