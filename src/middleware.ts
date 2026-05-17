import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  // Astro 6 uses Origin header checking for CSRF protection.
  // Generate a token for forms (for backward compat with any form fields that expect it).
  const token = 'dev-token-' + Math.random().toString(36).slice(2);
  context.locals.csrfToken = token;

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
