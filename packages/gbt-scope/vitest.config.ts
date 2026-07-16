import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import { join } from 'node:path'

export default defineConfig({
    plugins: [react()],
    test: {
        projects: [
            /* Plain node unit tests for the pure motion/util functions — no DOM, no browser. Run via
             * `vitest run --project unit` (the nx `test` target). */
            {
                test: {
                    environment: 'node',
                    include: ['src/**/*.test.ts'],
                    name: 'unit',
                },
            },
            /* Storybook browser tests (playwright) — opt-in via `vitest run --project storybook`
             * (the nx `test:bk` target); too heavy for the default CI/dev test run. */
            {
                extends: true,
                plugins: [
                    storybookTest({
                        /* Vitest compiles this config into node_modules/.vite-temp, which breaks
                         * import.meta-relative paths; both nx test targets run with cwd = package root. */
                        configDir: join(process.cwd(), '.storybook'),
                    }),
                ],
                test: {
                    browser: {
                        enabled: true,
                        headless: true,
                        instances: [
                            {
                                browser: 'chromium',
                            },
                        ],
                        provider: playwright({}),
                    },
                    name: 'storybook',
                    setupFiles: ['.storybook/vitest.setup.ts'],
                },
            },
        ],
    },
})
