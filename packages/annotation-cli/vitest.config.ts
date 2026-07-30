import { defineConfig } from 'vitest/config'

/**
 * Plain node unit tests — this package has no DOM dependency at all, which is the point of it. The inherited nx `test`
 * target (`vitest run --coverage`) works as-is.
 */
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
})
