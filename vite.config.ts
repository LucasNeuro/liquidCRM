import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '3000'),
    strictPort: true,
    hmr: {
      clientPort: parseInt(process.env.PORT || '3000'),
    },
  },
  preview: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '4173'),
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
