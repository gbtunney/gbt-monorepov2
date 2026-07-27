import type { Meta, StoryObj } from '@storybook/react'
import { SAMPLE_SHOTS, SAMPLE_VIDEO_LENGTH } from './data/derived.ts'
import ShotTimeline from '../components/ShotTimeline.tsx'
/* eslint perfectionist/sort-objects: "off" */

const meta: Meta<typeof ShotTimeline> = {
    args: {
        currentTime: 4,
        shots: SAMPLE_SHOTS,
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
    component: ShotTimeline,
    parameters: { layout: 'padded' },
    tags: ['autodocs'],
    title: 'VideoIntelligence/Components/ShotTimeline',
} satisfies Meta<typeof ShotTimeline>

export default meta
type Story = StoryObj<typeof meta>

/** Proportional shot blocks; the block containing `currentTime` is highlighted. Drag `currentTime` to move it. */
export const Default: Story = {}

/** No shots — the empty state. */
export const Empty: Story = { args: { shots: [] } }
