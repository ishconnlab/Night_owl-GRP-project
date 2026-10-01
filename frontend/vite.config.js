import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_BACKEND_URL ?? 'http://localhost:3000';

  return {
    plugins: [react()],
    server: {
      // Dev-only proxy so the browser talks to one origin and CORS never bites.
      proxy: { '/api': { target, changeOrigin: true } },
    },
  };
});