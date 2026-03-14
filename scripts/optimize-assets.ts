// scripts/optimize-assets.ts
// Runs on `bun run build:prod` or in CI.
// Dev builds use raw uncompressed assets for fast iteration.

import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const isDev = process.argv.includes('--dev');

if (isDev) {
    console.log('Skipping asset optimization in dev mode.');
    process.exit(0);
}

let hasGltfTransform = false;
try {
    execSync('bunx gltf-transform --version', { stdio: 'pipe' });
    hasGltfTransform = true;
} catch {
    console.warn('gltf-transform not found. Install with: bun add -d @gltf-transform/cli meshoptimizer');
    console.warn('Skipping GLB optimization.');
}

const GLB_DIRS = ['public'];

if (hasGltfTransform) {
    for (const dir of GLB_DIRS) {
        try {
            const files = readdirSync(dir, { recursive: true });
            for (const file of files) {
                const filePath = join(dir, String(file));
                if (!filePath.endsWith('.glb')) {
                    continue;
                }

                const before = statSync(filePath).size;
                console.log(`Optimizing ${filePath}...`);

                try {
                    execSync(`bunx gltf-transform optimize "${filePath}" "${filePath}" --compress meshopt`, {
                        stdio: 'pipe',
                    });
                    const after = statSync(filePath).size;
                    const savings = ((1 - after / before) * 100).toFixed(1);
                    console.log(
                        `  ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB (${savings}% smaller)`,
                    );
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    console.warn(`  Failed to optimize ${filePath}: ${message}`);
                }
            }
        } catch {
            console.warn(`Directory ${dir} not found, skipping.`);
        }
    }
}

console.log('Asset optimization complete.');
