import { defineStorybookMain } from '@snailicid3/storybook-config'

/*
 * The framework and story globs come from the shared config. Only the addon
 * list is stated here: the shared default still names `@storybook/addon-essentials`,
 * which was removed in Storybook 9 and does not exist on the Storybook 10 line
 * this package builds against.
 */
export default defineStorybookMain({
    addons: [
        '@chromatic-com/storybook',
        '@storybook/addon-vitest',
        '@storybook/addon-a11y',
        '@storybook/addon-docs',
    ],
})
