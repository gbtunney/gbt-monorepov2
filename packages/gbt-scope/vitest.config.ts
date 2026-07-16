import { getDirname } from '@snailicid3/config'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    plugins: [react()],
    test: {
        projects: [
            {
                extends: true,
                plugins: [
                    storybookTest({
                        configDir: getDirname(import.meta, '.storybook'),
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
