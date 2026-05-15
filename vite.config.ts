import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Tailwind v4 is now a direct Vite plugin
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'AI Track',
        short_name: 'Track',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'https://placehold.co/192x192/1e293b/ffffff.png?text=AI', 
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://placehold.co/512x512/1e293b/ffffff.png?text=AI',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})