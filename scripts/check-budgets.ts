import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

type Budget = {
    maxSingleFileMB: number;
    maxTotalSizeMB: number;
};

const BUDGETS: Record<string, Budget> = {
    'dist/assets': {
        maxSingleFileMB: 21,
        maxTotalSizeMB: 100,
    },
};

let failed = false;

for (const [dir, budget] of Object.entries(BUDGETS)) {
    try {
        const files = readdirSync(dir, { recursive: true });
        let totalSize = 0;

        for (const file of files) {
            const path = join(dir, String(file));
            const stat = statSync(path);
            if (!stat.isFile()) {
                continue;
            }

            const sizeMB = stat.size / (1024 * 1024);
            totalSize += sizeMB;

            if (sizeMB > budget.maxSingleFileMB) {
                console.error(`❌ BUDGET: ${path} = ${sizeMB.toFixed(1)} MB (max ${budget.maxSingleFileMB} MB)`);
                failed = true;
            }
        }

        if (totalSize > budget.maxTotalSizeMB) {
            console.error(`❌ BUDGET: ${dir} total = ${totalSize.toFixed(1)} MB (max ${budget.maxTotalSizeMB} MB)`);
            failed = true;
        } else {
            console.log(`✅ ${dir}: ${totalSize.toFixed(1)} MB / ${budget.maxTotalSizeMB} MB`);
        }
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
            console.error(`❌ Directory ${dir} not found. Run "bun run build" first.`);
            failed = true;
            continue;
        }

        throw error;
    }
}

if (failed) {
    process.exit(1);
}
console.log('All asset budgets passed.');
