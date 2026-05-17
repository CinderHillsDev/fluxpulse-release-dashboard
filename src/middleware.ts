import { defineMiddleware } from 'astro:middleware';
import { getClientSecret } from 'astro';

// In Astro 6+, CSRF protection is automatic for POST requests.
// getClientSecret() returns Astro's built-in CSRF token for this request.
export const onRequest = defineMiddleware(async (context, next) => {
  const token = getClientSecret();
  context.locals.csrfToken = token;
  return next();
});
