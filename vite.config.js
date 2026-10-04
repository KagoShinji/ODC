import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'motion-vendor': ['framer-motion'],
          'ui-vendor': ['lucide-react'],
          'firebase-firestore': ['firebase/firestore'],
          'firebase-auth': ['firebase/auth'],
          'firebase-platform': ['firebase/app', 'firebase/analytics', 'firebase/app-check', 'firebase/functions', 'firebase/storage'],
        },
      },
    },
  },
})
