// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],

  // Hybrid rendering: Canvas and WebAssembly routes are client-only SPA
  routeRules: {
    '/editor/**': { ssr: false },
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
