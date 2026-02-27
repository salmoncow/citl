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

      rollupOptions: {
        // Keep Firebase SDK on CDN as external (Phase 2+)
        external: [/^https:\/\/www\.gstatic\.com\/firebasejs\/.*/],

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
    },

    server: {
      port: 3000,
      open: true,
      cors: true,
    },

    preview: {
      port: 3000,
    },

    envPrefix: 'VITE_',

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@modules': path.resolve(__dirname, './src/modules'),
        '@assets': path.resolve(__dirname, './src/assets'),
        '@views': path.resolve(__dirname, './src/views'),
      },
    },
  };
});
