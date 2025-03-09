// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_SERVER_URL || 'http://localhost:3000', // Your backend server address
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
