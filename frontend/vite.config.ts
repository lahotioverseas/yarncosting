import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// FastAPI backend address used by the dev-server proxy (all /api/* calls go there)
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: Number(process.env.FRONTEND_PORT) || 3000,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: BACKEND_URL,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: Number(process.env.FRONTEND_PORT) || 3000,
      proxy: {
        '/api': {
          target: BACKEND_URL,
          changeOrigin: true,
        },
      },
    },
  };
});
