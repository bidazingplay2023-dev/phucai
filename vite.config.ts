import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    // Proxy configuration to solve CORS locally
    proxy: {
      '/api/everai': {
        target: 'https://api.everai.vn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/everai/, ''),
        secure: false, // In case of SSL issues
      }
    }
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve('.'),
    }
  }
});