import path from 'path';
import { defineConfig } from 'vite';
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [
    react(),
    sentryVitePlugin({
      org: "miuim", // This should probably be configurable or match user project
      project: "javascript-react"
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'ui-vendor': ['@phosphor-icons/react']
        }
      }
    }
  }
});
