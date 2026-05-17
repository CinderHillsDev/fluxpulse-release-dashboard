import { defineMiddleware } from 'astro:middleware';

// In Astro 6+, CSRF protection is automatic for POST requests.
// This middleware makes the CSRF token available to page components.
export const onRequest = defineMiddleware(async (context, next) => {
  // Generate a CSRF token for form submissions
  // Astro 6 expects tokens via astro.csrf form field
  const token = crypto.getRandomValues(new Uint8Array(32))
    .reduce((s, b) => s + (b < 16 ? '0' : '') + b.toString(16), '');
  context.locals.csrfToken = token;
  return next();
});
