import type { Meta, StoryObj } from '@storybook/react'
import FileLoader from '../components/FileLoader.tsx'
/* eslint perfectionist/sort-objects: "off" */

const meta: Meta<typeof FileLoader> = {
    component: FileLoader,
    parameters: { layout: 'padded' },
    tags: ['autodocs'],
    title: 'VideoIntelligence/Components/FileLoader',
} satisfies Meta<typeof FileLoader>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The two client-side loaders. `onVideoSelected` / `onAnnotationsSelected` fire as Storybook Actions; load a real
 * annotation JSON to see it parsed (or an invalid one to see the error `Alert`).
 */
export const Default: Story = {}
