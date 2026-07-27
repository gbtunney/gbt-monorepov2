import type { Meta, StoryObj } from '@storybook/react'
import { sampleAnnotations } from './data/sample-annotations.ts'
import VideoIntelligenceViewer, {
    defaultVideoIntelligenceViewerProps,
} from '../components/VideoIntelligenceViewer.tsx'
/* eslint  perfectionist/sort-objects: "off" */

const meta: Meta<typeof VideoIntelligenceViewer> = {
    args: { ...defaultVideoIntelligenceViewerProps },
    argTypes: {
        defaultThreshold: {
            control: { max: 1, min: 0, step: 0.01, type: 'range' },
        },
    },
    component: VideoIntelligenceViewer,
    parameters: { layout: 'padded' },
    tags: ['autodocs'],
    title: 'VideoIntelligence/Viewer',
} satisfies Meta<typeof VideoIntelligenceViewer>

export default meta

type ViewerStory = StoryObj<typeof meta>

/**
 * Annotations pre-loaded from the bundled sample. The shot + label timelines render immediately; use "Load video" to
 * attach a local clip and watch the person box track playback, and drag the confidence slider to filter low-confidence
 * detections (the "sky" label drops out above ~0.34).
 */
export const WithSampleData: ViewerStory = {
    args: {
        ...defaultVideoIntelligenceViewerProps,
        initialAnnotations: sampleAnnotations,
    },
}

/** Empty state — both file loaders visible, nothing pre-loaded. */
export const Empty: ViewerStory = {
    args: { ...defaultVideoIntelligenceViewerProps },
}
