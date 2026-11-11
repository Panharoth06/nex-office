// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],

  // Hybrid rendering: canvas and WebAssembly routes are client-only SPA
  routeRules: {
    '/editor/**': { ssr: false },
  },

  runtimeConfig: {
    public: {
      // Empty means same-origin: Caddy in Docker, Nuxt devProxy locally.
      apiBase: process.env.NUXT_PUBLIC_API_BASE ?? '',
      syncUrl: process.env.NUXT_PUBLIC_SYNC_URL || 'ws://localhost:8081/ws',
      devAuth: process.env.NUXT_PUBLIC_DEV_AUTH === 'true',
    },
  },

  // Proxy API calls during local development so cookies stay same-origin.
  nitro: {
    devProxy: {
      '/api': {
        target: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },

  vite: {
    server: {
      headers: {
        // Required for SharedArrayBuffer multithreading in Web Workers
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    optimizeDeps: {
      exclude: ['canvaskit-wasm'],
    },
  },
})
