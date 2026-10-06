import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  return {
    root: 'src',
    publicDir: '../public',
    envDir: '..',

    build: {
      outDir: '../dist',
      emptyOutDir: true,
      assetsDir: 'assets',

      rolldownOptions: {
        output: {
          assetFileNames: (assetInfo) => {
            const ext = assetInfo.name.split('.').pop();
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return 'assets/images/[name]-[hash][extname]';
            }
            if (/css/i.test(ext)) {
              return 'assets/styles/[name]-[hash][extname]';
            }
            return 'assets/[name]-[hash][extname]';
          },
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
        },
      },

      sourcemap: mode === 'production' ? true : 'inline',
      minify: 'terser',
      cssCodeSplit: true,
      // The largest chunk is the Firebase SDK (Firestore + Auth, ~565 kB min / ~165 kB gzip),
      // which every page needs at startup. The limit sits just above it so the warning
      // only fires if app code grows.
      chunkSizeWarningLimit: 600,
    },

    server: {
      port: 3000,
      open: true,
      cors: true,
      headers: {
        'Cross-Origin-Opener-Policy': 'unsafe-none',
      },
    },

    preview: {
      port: 3000,
    },

    envPrefix: 'VITE_',

    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
        '@modules': path.resolve(import.meta.dirname, './src/modules'),
        '@assets': path.resolve(import.meta.dirname, './src/assets'),
        '@views': path.resolve(import.meta.dirname, './src/views'),
      },
    },
  };
});
