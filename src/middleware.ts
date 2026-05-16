import { defineMiddleware } from 'astro:middleware';

// Local development: no authentication required
export const onRequest = defineMiddleware(async (context, next) => {
  return next();
});
