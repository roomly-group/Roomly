import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { API_BASE_PATH } from '../backend/local-libs/api-zod/src/constants';

// ===================== CONFIGURATION =====================

/** Default development and preview server port when PORT is unset (port). */
const DEFAULT_SERVER_PORT = 5173 as const;
/** Fallback backend origin used by the Vite API proxy (URL). */
const DEFAULT_BACKEND_URL = 'http://localhost:3001' as const;
/** Host interface used by the Vite development and preview servers. */
const SERVER_HOST = '0.0.0.0' as const;
/** Chunk-size threshold used by Vite's build warning (KB). */
const CHUNK_SIZE_WARNING_LIMIT_KB = 1000 as const;

const port = Number(process.env.PORT) || DEFAULT_SERVER_PORT;
const backendUrl = process.env.BACKEND_URL || DEFAULT_BACKEND_URL;

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
    sourcemap: true,
    chunkSizeWarningLimit: CHUNK_SIZE_WARNING_LIMIT_KB,
  },
  server: {
    port,
    strictPort: true,
    host: SERVER_HOST,
    fs: {
      strict: true,
    },
    proxy: {
      [API_BASE_PATH]: {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: SERVER_HOST,
  },
});
