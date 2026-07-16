import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import { join } from 'node:path'

/**
 * Storybook browser tests (playwright/chromium) — opt-in via the nx `test:bk` target; too heavy for the default
 * CI/dev test run. Unit tests live in `vitest.config.ts`.
 */
export default defineConfig({
    plugins: [
        react(),
        storybookTest({
            /* Vitest compiles this config into node_modules/.vite-temp, which breaks import.meta-relative
             * paths; the nx target runs with cwd = package root. */
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
})
