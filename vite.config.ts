import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { parse } from 'yaml';

/** Compile `content/*.yaml` to JSON modules at build time. */
function yamlContent(): Plugin {
  return {
    name: 'yaml-content',
    transform(code, id) {
      if (!/\.ya?ml$/.test(id)) return null;
      return { code: `export default ${JSON.stringify(parse(code))};`, map: null };
    },
  };
}

export default defineConfig({
  plugins: [
    yamlContent(),
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'nimi pona — Toki Pona',
        short_name: 'nimi pona',
        description: 'Learn Toki Pona: words, grammar and sitelen pona.',
        lang: 'en',
        theme_color: '#f4efe4',
        background_color: '#f4efe4',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
