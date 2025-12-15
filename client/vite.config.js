import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  server: {
    port: 3000, // Frontend on 3000
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // Backend on 3001
        changeOrigin: true,
      }
    }
  }
})
