import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createStudioHandler } from './api/studio';
import { createVenueMapHandler } from './api/venue-map';

function studioApi(): Plugin {
  const handler = createStudioHandler();
  return {
    name: 'studio-server-api',
    configureServer(server) { server.middlewares.use('/api/studio', handler); },
    configurePreviewServer(server) { server.middlewares.use('/api/studio', handler); },
  };
}

function venueMapApi(): Plugin {
  const handler = createVenueMapHandler();
  return {
    name: 'venue-map-server-api',
    configureServer(server) { server.middlewares.use('/api/venue-map', handler); },
    configurePreviewServer(server) { server.middlewares.use('/api/venue-map', handler); },
  };
}

export default defineConfig(({ mode }) => {
  // Only server configuration is loaded into the Node process, never client defines.
  const env = loadEnv(mode, process.cwd(), '');
  for (const name of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'STUDIO_ADMIN_USER_ID', 'APP_ORIGIN']) {
    if (!process.env[name] && env[name]) process.env[name] = env[name];
  }
  return {
    plugins: [react(), studioApi(), venueMapApi()],
    server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
    preview: { host: '0.0.0.0', port: 5173, allowedHosts: true },
    build: { rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom', 'react-dom/client'] } } } },
  };
});
