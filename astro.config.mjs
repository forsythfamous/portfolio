// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://forsythfamous.pages.dev',
  // Cloudflare Pages serves directory URLs with a slash; links without one get a 308.
  trailingSlash: 'always',
  build: {
    // Keep all CSS in external files so the CSP can use style-src 'self'.
    inlineStylesheets: 'never',
  },
  markdown: {
    // Shiki emits style="" attributes, which style-src 'self' would block.
    syntaxHighlight: false,
  },
  vite: {
    // Never inline assets (e.g. small font subsets) as data: URIs; font-src is 'self'.
    build: { assetsInlineLimit: 0 },
  },
});
