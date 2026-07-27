import { Box } from '@mui/material'
import type { Meta, StoryObj } from '@storybook/react'
import { type ReactElement, useEffect, useState } from 'react'
import AnnotationCanvas from '../components/AnnotationCanvas.tsx'
import { fetchAnnotations } from '../parse.ts'
import {
    selectObjectTracks,
    selectPersonTracks,
    selectText,
} from '../select.ts'
import { type VideoAnnotations } from '../types.ts'
/* eslint perfectionist/sort-objects: "off" */

// The canvas overlays a real <video>, so this story uses the original project's demo assets (matching annotations +
// footage). Fetched live; snapshot disabled because it is animated and network-backed.
const DEMO_VIDEO_URL =
    'https://zackakil.github.io/video-intelligence-api-visualiser/assets/test_video.mp4'
const DEMO_JSON_URL =
    'https://zackakil.github.io/video-intelligence-api-visualiser/assets/test_json.json'

const meta: Meta<typeof AnnotationCanvas> = {
    argTypes: {
        threshold: { control: { max: 1, min: 0, step: 0.01, type: 'range' } },
    },
    component: AnnotationCanvas,
    parameters: {
        chromatic: { disableSnapshot: true },
        layout: 'centered',
    },
    tags: ['autodocs'],
    title: 'VideoIntelligence/Components/AnnotationCanvas',
} satisfies Meta<typeof AnnotationCanvas>

export default meta
type Story = StoryObj<typeof meta>

const CanvasOverDemo = ({ threshold }: { threshold: number }): ReactElement => {
    const [video, setVideo] = useState<HTMLVideoElement | null>(null)
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
        <Box sx={{ position: 'relative', width: 640 }}>
            <video
                controls
                ref={setVideo}
                src={DEMO_VIDEO_URL}
                style={{ display: 'block', width: '100%' }}
            />
            {data !== null && (
                <AnnotationCanvas
                    objectTracks={selectObjectTracks(data)}
                    textItems={selectText(data)}
                    threshold={threshold}
                    tracks={selectPersonTracks(data)}
                    video={video}
                />
            )}
        </Box>
    )
}

/** Person (blue) + object (green) + text (amber) overlays over the demo footage. Press play; drag `threshold`. */
export const Default: Story = {
    args: { threshold: 0.5 },
    render: (args): ReactElement => (
        <CanvasOverDemo threshold={args.threshold} />
    ),
}
