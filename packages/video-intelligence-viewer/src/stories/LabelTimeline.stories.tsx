import type { Meta, StoryObj } from '@storybook/react'
import { SAMPLE_LABELS, SAMPLE_VIDEO_LENGTH } from './data/derived.ts'
import LabelTimeline from '../components/LabelTimeline.tsx'
/* eslint perfectionist/sort-objects: "off" */

const meta: Meta<typeof LabelTimeline> = {
    args: {
        currentTime: 4,
        labels: SAMPLE_LABELS,
        threshold: 0.5,
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
        threshold: { control: { max: 1, min: 0, step: 0.01, type: 'range' } },
    },
    component: LabelTimeline,
    parameters: { layout: 'padded' },
    tags: ['autodocs'],
    title: 'VideoIntelligence/Components/LabelTimeline',
} satisfies Meta<typeof LabelTimeline>

export default meta
type Story = StoryObj<typeof meta>

/** Per-label segment bars + the "current labels" list. Raise `threshold` to drop low-confidence labels. */
export const Default: Story = {}

/** Threshold above every label's confidence — the empty state. */
export const AllFilteredOut: Story = { args: { threshold: 0.99 } }
