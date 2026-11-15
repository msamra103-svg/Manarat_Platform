import { defineConfig } from 'vite';

// base نسبي حتى تعمل النسخة المبنية داخل أي مجلد فرعي على استضافة ثابتة.
export default defineConfig({
  base: './',
  build: { target: 'es2019', outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 1200 },
  server: { host: '127.0.0.1', port: 5173 }
});
