import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, '.', 'POOSTA_');
    var apiTarget = env.POOSTA_API_URL || 'http://127.0.0.1:8787';
    return {
        plugins: [react()],
        resolve: {
            alias: { '@': new URL('./src', import.meta.url).pathname },
        },
        server: {
            host: true,
            port: 5173,
            proxy: {
                '/api': { target: apiTarget, changeOrigin: true },
                '/health': { target: apiTarget, changeOrigin: true },
            },
        },
    };
});
