import { defineConfig } from 'vitest/config'

/**
 * Plain node unit tests for the pure parse/util functions — no DOM, no browser — so the inherited nx `test` target
 * (`vitest run --coverage`) just works. The storybook browser tests live in `vitest.storybook.config.ts` (nx
 * `test:bk`).
 */
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
})
