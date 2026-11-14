import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `npm run dev:worker` serves the email API locally on 8787.
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'motion-vendor': ['framer-motion'],
          'gsap-vendor': ['gsap', 'gsap/ScrollTrigger', '@gsap/react'],
          'ui-vendor': ['lucide-react'],
          'firebase-firestore': ['firebase/firestore'],
          'firebase-auth': ['firebase/auth'],
          'firebase-platform': ['firebase/app', 'firebase/analytics', 'firebase/app-check', 'firebase/functions', 'firebase/storage'],
        },
      },
    },
  },
})
