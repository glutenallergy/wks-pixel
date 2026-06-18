import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'), // tab-switcher shell
        v1: path.resolve(__dirname, 'v1.html'), // original Grid Engine
        v2: path.resolve(__dirname, 'v2.html'), // Image → Grid
      },
    },
  },
});
