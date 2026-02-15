import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''
const isUserOrOrgPagesRepo = repositoryName.endsWith('.github.io')
const pagesBase =
  process.env.GITHUB_ACTIONS === 'true' && repositoryName && !isUserOrOrgPagesRepo
    ? `/${repositoryName}/`
    : '/'

// https://vite.dev/config/
export default defineConfig({
  base: pagesBase,
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-192.svg', 'pwa-512.svg'],
      manifest: {
        name: 'Family Shopping List',
        short_name: 'Shop Family',
        description: 'Peer-to-peer family shopping list',
        theme_color: '#111827',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: pagesBase,
        scope: pagesBase,
        icons: [
          {
            src: 'pwa-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'pwa-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        cacheId: 'family-shopping-v2',
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
