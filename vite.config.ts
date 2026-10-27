import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { loadHttpGateway } from './src/server/httpGateway';
import { createDatabaseGateway } from './src/server/databaseGateway';
import { createAuthGateway } from './src/server/authGateway';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'flowforge-http-preview',
      async configureServer(server) {
        const env = { ...loadEnv(server.config.mode, process.cwd(), 'FLOWFORGE_'), ...process.env };
        const { createHttpGateway } = await loadHttpGateway();
        const gateway = createHttpGateway({ preview: true, env });
        const dbGateway = createDatabaseGateway({ env });
        const authGateway = createAuthGateway();
        server.middlewares.use((req, res, next) => {
          const pathname = req.url?.split('?')[0] || '';
          if (['/__flowforge/http', '/__flowforge/secrets'].includes(pathname))
            void gateway(req, res);
          else if (pathname === '/__flowforge/db')
            void dbGateway(req, res);
          else if (pathname.startsWith('/__flowforge/auth'))
            void authGateway(req, res);
          else next();
        });
      },
    },
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@xyflow')) return 'vendor-flow';
            if (id.includes('jszip')) return 'vendor-zip';
            if (id.includes('lucide-react')) return 'vendor-icons';
          }
        },
      },
    },
  },
});
