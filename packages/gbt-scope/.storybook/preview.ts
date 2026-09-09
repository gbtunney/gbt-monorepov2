import type { Preview } from '@storybook/react-vite'

/*
 * This entry deliberately does not use `defineStorybookPreview` from
 * `@snailicid3/storybook-config`. Storybook bundles `preview.ts` into the
 * browser preview, and that helper reaches `@snailicid3/config`, whose barrel
 * pulls in api-extractor, node-utils, and the ESLint stack. Vite externalizes
 * node:fs / node:path / node:child_process for the browser and the preview
 * build then fails. `main.ts` is loaded in Node, so it uses the shared config.
 *
 * Revisit once `@snailicid3/storybook-config` reaches its `defineConfig`
 * helper without a Node-only import.
 */
const preview: Preview = {
    parameters: {
        a11y: {
            // 'todo' - show a11y violations in the test UI only
            // 'error' - fail CI on a11y violations
            // 'off' - skip a11y checks entirely
            test: 'todo',
        },

        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },
    },
}

export default preview
