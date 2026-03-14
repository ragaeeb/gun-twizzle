import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.ktx2'],
    build: {
        target: 'esnext',
    },
    plugins: [react()],
    test: {
        environment: 'node',
        exclude: ['e2e/**', 'node_modules/**'],
        globals: true,
    },
});
