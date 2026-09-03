import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const port = Number(process.env.PORT) || 5173;
const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(import.meta.dirname, 'assets'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    sourceMap: true,
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    fs: {
      strict: true,
    },
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
  },
});
