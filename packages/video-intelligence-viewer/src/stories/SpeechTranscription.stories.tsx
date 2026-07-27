import type { Meta, StoryObj } from '@storybook/react'
import { SAMPLE_SPEECH, SAMPLE_VIDEO_LENGTH } from './data/derived.ts'
import SpeechTranscription from '../components/SpeechTranscription.tsx'
/* eslint perfectionist/sort-objects: "off" */

const meta: Meta<typeof SpeechTranscription> = {
    args: {
        currentTime: 2,
        segments: SAMPLE_SPEECH,
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
    component: SpeechTranscription,
    parameters: { layout: 'padded' },
    tags: ['autodocs'],
    title: 'VideoIntelligence/Components/SpeechTranscription',
} satisfies Meta<typeof SpeechTranscription>

export default meta
type Story = StoryObj<typeof meta>

/** Word-by-word transcript; the word spoken at `currentTime` is highlighted. Drag `currentTime` to walk it. */
export const Default: Story = {}
