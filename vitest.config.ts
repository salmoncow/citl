import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@modules': path.resolve(import.meta.dirname, './src/modules'),
      '@assets': path.resolve(import.meta.dirname, './src/assets'),
      '@views': path.resolve(import.meta.dirname, './src/views'),
    },
  },
});
