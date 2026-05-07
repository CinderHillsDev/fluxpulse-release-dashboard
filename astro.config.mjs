// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// Worker-mode SSR. Output is entry.mjs (worker entry) and wrangler.json
// (merged config). The Worker serves every Astro page from the edge.
//
// imageService: 'compile' prevents Astro from auto-generating IMAGES
// binding, which conflicts with custom APP_KV binding in wrangler.toml.
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'compile',
    platformProxy: { enabled: true },
  }),
  integrations: [],
  trailingSlash: 'ignore',
  compressHTML: true,
});
