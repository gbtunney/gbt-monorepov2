import type { Meta, StoryObj } from '@storybook/react'
import { SAMPLE_TEXTS, SAMPLE_VIDEO_LENGTH } from './data/derived.ts'
import TextPanel from '../components/TextPanel.tsx'
/* eslint perfectionist/sort-objects: "off" */

const meta: Meta<typeof TextPanel> = {
    args: {
        currentTime: 4,
        textItems: SAMPLE_TEXTS,
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
    component: TextPanel,
    parameters: { layout: 'padded' },
    tags: ['autodocs'],
    title: 'VideoIntelligence/Components/TextPanel',
} satisfies Meta<typeof TextPanel>

export default meta
type Story = StoryObj<typeof meta>

/** Count above the threshold + the strings visible at `currentTime` (rotated boxes are on the canvas overlay). */
export const Default: Story = {}
