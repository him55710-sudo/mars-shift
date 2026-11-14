import {defineConfig} from 'vitest/config';

// Real-data graph fixtures are CPU-bound. Avoid worker contention on laptops;
// keep every assertion and the existing per-test deadline unchanged.
export default defineConfig({test:{maxWorkers:1}});
