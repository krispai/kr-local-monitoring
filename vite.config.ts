import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'KrispLocalMonitoringSDK',
      fileName: (format) => `krisp-local-monitoring.${format}.js`,
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['socket.io-client'],
      output: {
        globals: {
          'socket.io-client': 'io',
        },
      },
    },
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: true,
  },
});

