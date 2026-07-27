/**
 * A standalone, reusable video player with the detection canvas overlaid — the visual core of the viewer, without any
 * of the panels/controls. Drop it anywhere you have a video URL and (optionally) Video Intelligence annotations: it
 * renders a `<video>` with person/object/text overlays that track playback. With no `annotations` it's just a plain
 * video.
 *
 * The underlying `<video>` element is surfaced via `onVideoElement` so callers can drive their own timeline, seeking,
 * or `useVideoCurrentTime` / `useVideoInfo` off it.
 */

import { Box } from '@mui/material'
import {
    type CSSProperties,
    type ReactElement,
    useCallback,
    useMemo,
    useState,
} from 'react'
import AnnotationCanvas from './AnnotationCanvas.tsx'
import {
    selectObjectTracks,
    selectPersonTracks,
    selectText,
} from '../select.ts'
import { type VideoAnnotations } from '../types.ts'

export type AnnotatedVideoProps = {
    /** Annotations whose person/object/text detections are overlaid. Omit for a plain video. */
    annotations?: null | VideoAnnotations
    /** Show native video controls. Default `true`. */
    controls?: boolean
    /** Receives the underlying `<video>` element (or `null` on unmount) so callers can drive time/seek externally. */
    onVideoElement?: (video: HTMLVideoElement | null) => void
    /** Video source (object URL or any playable URL). Renders nothing when `null`. */
    src: null | string
    /** Extra styles merged onto the `<video>` element. */
    style?: CSSProperties
    /** Confidence gate for the overlays (0 shows everything). Default `0`. */
    threshold?: number
}

const emptyAnnotations: VideoAnnotations = { annotation_results: [] }

const AnnotatedVideo = ({
    annotations = null,
    controls = true,
    onVideoElement,
    src,
    style,
    threshold = 0,
}: AnnotatedVideoProps): null | ReactElement => {
    const [video, setVideo] = useState<HTMLVideoElement | null>(null)

    const data = annotations ?? emptyAnnotations
    const tracks = useMemo(() => selectPersonTracks(data), [data])
    const objects = useMemo(() => selectObjectTracks(data), [data])
    const texts = useMemo(() => selectText(data), [data])

    const handleRef = useCallback(
        (element: HTMLVideoElement | null): void => {
            setVideo(element)
            onVideoElement?.(element)
        },
        [onVideoElement],
    )

    if (src === null) return null

    return (
        <Box
            sx={{
                display: 'inline-block',
                lineHeight: 0,
                position: 'relative',
            }}>
            <video
                controls={controls}
                ref={handleRef}
                src={src}
                style={{ display: 'block', maxWidth: '100%', ...style }}
            />
            <AnnotationCanvas
                objectTracks={objects}
                textItems={texts}
                threshold={threshold}
                tracks={tracks}
                video={video}
            />
        </Box>
    )
}

export default AnnotatedVideo
