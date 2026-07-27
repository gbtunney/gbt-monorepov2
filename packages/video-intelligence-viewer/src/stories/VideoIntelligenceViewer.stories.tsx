import type { Meta, StoryObj } from '@storybook/react'
import { type ReactElement, useEffect, useState } from 'react'
import { sampleAnnotations } from './data/sample-annotations.ts'
import VideoIntelligenceViewer, {
    defaultVideoIntelligenceViewerProps,
} from '../components/VideoIntelligenceViewer.tsx'
import { fetchAnnotations } from '../parse.ts'
import { type VideoAnnotations } from '../types.ts'
/* eslint  perfectionist/sort-objects: "off" */

/** The original project's hosted demo assets (served with permissive CORS from GitHub Pages). */
const DEMO_VIDEO_URL =
    'https://zackakil.github.io/video-intelligence-api-visualiser/assets/test_video.mp4'
const DEMO_JSON_URL =
    'https://zackakil.github.io/video-intelligence-api-visualiser/assets/test_json.json'

/** Loads the ~14 MB demo annotations at mount, then renders the viewer with the demo video pre-attached. */
const DemoRemoteViewer = (): ReactElement => {
    const [annotations, setAnnotations] = useState<null | VideoAnnotations>(
        null,
    )
    const [error, setError] = useState<null | string>(null)

    useEffect(() => {
        let cancelled = false
        void fetchAnnotations(DEMO_JSON_URL)
            .then((data) => {
                if (!cancelled) setAnnotations(data)
            })
            .catch((caught: unknown) => {
                if (!cancelled)
                    setError(
                        caught instanceof Error
                            ? caught.message
                            : String(caught),
                    )
            })
        return (): void => {
            cancelled = true
        }
    }, [])

    if (error !== null) return <div>Failed to load demo data: {error}</div>
    if (annotations === null)
        return <div>Loading demo annotations (~14 MB)…</div>
    return (
        <VideoIntelligenceViewer
            initialAnnotations={annotations}
            videoSrc={DEMO_VIDEO_URL}
        />
    )
}

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

/**
 * The full original demo: real Video Intelligence output (74 shots, 85 labels, 97 person tracks) over the demo video,
 * both fetched live from the project's GitHub Pages assets. Press play and watch the person boxes track the footage.
 */
export const DemoRemote: ViewerStory = {
    parameters: { chromatic: { disableSnapshot: true } },
    render: () => <DemoRemoteViewer />,
}

/** Empty state — both file loaders visible, nothing pre-loaded. */
export const Empty: ViewerStory = {
    args: { ...defaultVideoIntelligenceViewerProps },
}
