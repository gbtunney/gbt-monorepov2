import type { Meta, StoryObj } from '@storybook/react'
import { type ReactElement, useEffect, useState } from 'react'
import AnnotatedVideo from '../components/AnnotatedVideo.tsx'
import { fetchAnnotations } from '../parse.ts'
import { type VideoAnnotations } from '../types.ts'
/* eslint perfectionist/sort-objects: "off" */

// The reusable video primitive needs a real src, so the stories use the original project's hosted demo assets
// (matching annotations + footage). Fetched live; snapshots disabled because they are animated + network-backed.
const DEMO_VIDEO_URL =
    'https://zackakil.github.io/video-intelligence-api-visualiser/assets/test_video.mp4'
const DEMO_JSON_URL =
    'https://zackakil.github.io/video-intelligence-api-visualiser/assets/test_json.json'

const meta: Meta<typeof AnnotatedVideo> = {
    argTypes: {
        threshold: { control: { max: 1, min: 0, step: 0.01, type: 'range' } },
    },
    component: AnnotatedVideo,
    parameters: {
        chromatic: { disableSnapshot: true },
        layout: 'centered',
    },
    tags: ['autodocs'],
    title: 'VideoIntelligence/AnnotatedVideo',
} satisfies Meta<typeof AnnotatedVideo>

export default meta
type Story = StoryObj<typeof meta>

const WithDemoAnnotations = ({
    threshold,
}: {
    threshold: number
}): ReactElement => {
    const [data, setData] = useState<null | VideoAnnotations>(null)
    useEffect(() => {
        let cancelled = false
        void fetchAnnotations(DEMO_JSON_URL)
            .then((loaded) => {
                if (!cancelled) setData(loaded)
            })
            .catch(() => undefined)
        return (): void => {
            cancelled = true
        }
    }, [])
    return (
        <AnnotatedVideo
            annotations={data}
            src={DEMO_VIDEO_URL}
            threshold={threshold}
        />
    )
}

/** Video + person/object/text overlays from the live demo annotations. Press play; drag `threshold` to filter. */
export const WithOverlays: Story = {
    args: { threshold: 0.5 },
    render: (args): ReactElement => (
        <WithDemoAnnotations threshold={args.threshold ?? 0.5} />
    ),
}

/** No annotations — the component is just a plain, reusable video player. */
export const PlainVideo: Story = {
    args: { annotations: null, src: DEMO_VIDEO_URL },
}
