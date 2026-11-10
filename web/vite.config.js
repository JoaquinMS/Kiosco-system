import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Todo lo que empiece con /api se reenvía al servidor Node.
    // Así el navegador cree que habla con un solo servidor y evitamos problemas de CORS.
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
});