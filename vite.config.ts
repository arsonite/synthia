// Node imports
import path from 'path';

// Vite imports
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    css: {
        preprocessorOptions: {
            scss: {
                // Use the modern Sass compiler API (the legacy one is deprecated)
                api: 'modern-compiler',
                // Inject the design tokens into every SCSS file
                additionalData: '@use "@/_style/variables" as *;\n',
            },
        },
    },
    server: {
        // Spotify no longer accepts "localhost" redirect URIs, only loopback IP literals.
        // Serving on 127.0.0.1 keeps the whole flow on the registered redirect host.
        host: '127.0.0.1',
        port: 5173,
        strictPort: true,
    },
});
