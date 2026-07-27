import type { Meta, StoryObj } from '@storybook/react'
import { SAMPLE_EXPLICIT, SAMPLE_VIDEO_LENGTH } from './data/derived.ts'
import ExplicitContentPanel from '../components/ExplicitContentPanel.tsx'
/* eslint perfectionist/sort-objects: "off" */

const meta: Meta<typeof ExplicitContentPanel> = {
    args: {
        currentTime: 4,
        frames: SAMPLE_EXPLICIT,
        videoLength: SAMPLE_VIDEO_LENGTH,
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
    },
    component: ExplicitContentPanel,
    parameters: { layout: 'padded' },
    tags: ['autodocs'],
    title: 'VideoIntelligence/Components/ExplicitContentPanel',
} satisfies Meta<typeof ExplicitContentPanel>

export default meta
type Story = StoryObj<typeof meta>

/** Likelihood-colored timeline (green → red) + the current rating. Drag `currentTime` to move through it. */
export const Default: Story = {}
