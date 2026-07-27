/**
 * The top-level visualiser: a `<video>` with a person-detection canvas overlay, plus shot/label timelines, a shared
 * confidence slider, and local file loaders. Everything is client-side — load a video and an annotation JSON with the
 * buttons, or seed `initialAnnotations` / `videoSrc` up front (as the Storybook stories do).
 */

import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Divider,
    Stack,
    Typography,
} from '@mui/material'
import {
    type ReactElement,
    type ReactNode,
    useCallback,
    useMemo,
    useState,
} from 'react'
import AnnotatedVideo from './AnnotatedVideo.tsx'
import ConfidenceSlider from './ConfidenceSlider.tsx'
import ExplicitContentPanel from './ExplicitContentPanel.tsx'
import FileLoader from './FileLoader.tsx'
import LabelTimeline from './LabelTimeline.tsx'
import ObjectPanel from './ObjectPanel.tsx'
import ShotTimeline from './ShotTimeline.tsx'
import SpeechTranscription from './SpeechTranscription.tsx'
import TextPanel from './TextPanel.tsx'
import { useVideoCurrentTime, useVideoInfo } from '../hooks/useVideoElement.ts'
import {
    selectExplicitFrames,
    selectLabels,
    selectObjectTracks,
    selectShots,
    selectSpeech,
    selectText,
} from '../select.ts'
import { type VideoAnnotations } from '../types.ts'

export type VideoIntelligenceViewerProps = {
    /** Confidence threshold the shared slider starts at. */
    defaultThreshold?: number
    /** Pre-loaded annotations (skips needing a JSON upload). */
    initialAnnotations?: null | VideoAnnotations
    /** Pre-loaded video source (object URL or any playable URL). */
    videoSrc?: null | string
}

/** Single source of truth for default props — mirrors gbt-scope's `defaultGbt...Props` pattern. */
// eslint-disable-next-line react-refresh/only-export-components -- default args belong beside the component; costs only HMR granularity.
export const defaultVideoIntelligenceViewerProps = {
    defaultThreshold: 0.5,
    initialAnnotations: null,
    videoSrc: null,
} satisfies VideoIntelligenceViewerProps

const emptyAnnotations: VideoAnnotations = { annotation_results: [] }

/**
 * One collapsible feature section. Each is an independent (non-exclusive) accordion, so any combination can be open at
 * once — collapse the panels you're not comparing. Starts expanded.
 */
const Section = ({
    children,
    title,
}: {
    children: ReactNode
    title: string
}): ReactElement => (
    <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<Box component="span">▾</Box>}>
            <Typography variant="subtitle2">{title}</Typography>
        </AccordionSummary>
        <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
)

const VideoIntelligenceViewer = ({
    defaultThreshold = defaultVideoIntelligenceViewerProps.defaultThreshold,
    initialAnnotations = null,
    videoSrc = null,
}: VideoIntelligenceViewerProps): ReactElement => {
    const [video, setVideo] = useState<HTMLVideoElement | null>(null)
    const [videoUrl, setVideoUrl] = useState<null | string>(videoSrc)
    const [annotations, setAnnotations] = useState<VideoAnnotations>(
        initialAnnotations ?? emptyAnnotations,
    )
    const [threshold, setThreshold] = useState(defaultThreshold)

    const currentTime = useVideoCurrentTime(video)
    const videoInfo = useVideoInfo(video)

    const shots = useMemo(() => selectShots(annotations), [annotations])
    const labels = useMemo(() => selectLabels(annotations), [annotations])
    const speech = useMemo(() => selectSpeech(annotations), [annotations])
    const objects = useMemo(
        () => selectObjectTracks(annotations),
        [annotations],
    )
    const texts = useMemo(() => selectText(annotations), [annotations])
    const explicit = useMemo(
        () => selectExplicitFrames(annotations),
        [annotations],
    )

    const handleSeek = useCallback(
        (seconds: number): void => {
            // eslint-disable-next-line react-hooks/immutability -- imperative DOM seek on the video element, not React state.
            if (video !== null) video.currentTime = seconds
        },
        [video],
    )

    const videoLength = videoInfo?.length ?? 0

    return (
        <Stack spacing={2} sx={{ maxWidth: 900, width: '100%' }}>
            <Typography variant="h6">Video Intelligence Viewer</Typography>

            <FileLoader
                onAnnotationsSelected={setAnnotations}
                onVideoSelected={setVideoUrl}
            />

            <Box
                sx={{
                    bgcolor: 'black',
                    display: 'flex',
                    justifyContent: 'center',
                    position: 'relative',
                    width: '100%',
                }}>
                {videoUrl === null ? (
                    <Box sx={{ color: 'grey.500', p: 6 }}>
                        <Typography variant="body2">
                            Load a video to begin.
                        </Typography>
                    </Box>
                ) : (
                    <AnnotatedVideo
                        annotations={annotations}
                        onVideoElement={setVideo}
                        src={videoUrl}
                        threshold={threshold}
                    />
                )}
            </Box>

            <ConfidenceSlider onChange={setThreshold} value={threshold} />

            <Divider />

            <Box>
                <Section title="Shots">
                    <ShotTimeline
                        currentTime={currentTime}
                        hideHeading
                        onSeek={handleSeek}
                        shots={shots}
                        videoLength={videoLength}
                    />
                </Section>

                <Section title="Labels">
                    <LabelTimeline
                        currentTime={currentTime}
                        hideHeading
                        labels={labels}
                        onSeek={handleSeek}
                        threshold={threshold}
                        videoLength={videoLength}
                    />
                </Section>

                <Section title="Objects">
                    <ObjectPanel
                        currentTime={currentTime}
                        hideHeading
                        objectTracks={objects}
                        threshold={threshold}
                    />
                </Section>

                <Section title="Text">
                    <TextPanel
                        currentTime={currentTime}
                        hideHeading
                        textItems={texts}
                        threshold={threshold}
                    />
                </Section>

                <Section title="Explicit content">
                    <ExplicitContentPanel
                        currentTime={currentTime}
                        frames={explicit}
                        hideHeading
                        onSeek={handleSeek}
                        videoLength={videoLength}
                    />
                </Section>

                <Section title="Speech transcription">
                    <SpeechTranscription
                        currentTime={currentTime}
                        hideHeading
                        onSeek={handleSeek}
                        segments={speech}
                        threshold={threshold}
                    />
                </Section>
            </Box>
        </Stack>
    )
}

export default VideoIntelligenceViewer
