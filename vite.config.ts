import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    preview: {
      allowedHosts: ['liquidcrm.onrender.com', 'localhost', '127.0.0.1'],
    },
  },
})
