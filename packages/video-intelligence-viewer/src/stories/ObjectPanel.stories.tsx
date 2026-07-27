import type { Meta, StoryObj } from '@storybook/react'
import { SAMPLE_OBJECTS, SAMPLE_VIDEO_LENGTH } from './data/derived.ts'
import ObjectPanel from '../components/ObjectPanel.tsx'
/* eslint perfectionist/sort-objects: "off" */

const meta: Meta<typeof ObjectPanel> = {
    args: {
        currentTime: 4,
        objectTracks: SAMPLE_OBJECTS,
        threshold: 0.5,
    },
    argTypes: {
        currentTime: {
            control: {
                max: SAMPLE_VIDEO_LENGTH,
                min: 0,
                step: 0.1,
                type: 'range',
            },
        },
        threshold: { control: { max: 1, min: 0, step: 0.01, type: 'range' } },
    },
    component: ObjectPanel,
    parameters: { layout: 'padded' },
    tags: ['autodocs'],
    title: 'VideoIntelligence/Components/ObjectPanel',
} satisfies Meta<typeof ObjectPanel>

export default meta
type Story = StoryObj<typeof meta>

/** Count above the threshold + the objects visible at `currentTime` (boxes themselves are on the canvas overlay). */
export const Default: Story = {}
