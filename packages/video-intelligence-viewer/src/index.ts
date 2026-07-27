/** Public API barrel for `@snailicid3/video-intelligence-viewer` */

/** Overlay + panels */
export {
    default as AnnotationCanvas,
    type AnnotationCanvasProps,
} from './components/AnnotationCanvas.tsx'

export {
    default as ConfidenceSlider,
    type ConfidenceSliderProps,
} from './components/ConfidenceSlider.tsx'
export {
    default as FileLoader,
    type FileLoaderProps,
} from './components/FileLoader.tsx'
export {
    default as LabelTimeline,
    type LabelTimelineProps,
} from './components/LabelTimeline.tsx'
export {
    default as ShotTimeline,
    type ShotTimelineProps,
} from './components/ShotTimeline.tsx'
/** Main viewer */
export {
    defaultVideoIntelligenceViewerProps,
    default as VideoIntelligenceViewer,
    type VideoIntelligenceViewerProps,
} from './components/VideoIntelligenceViewer.tsx'

/** Hooks */
export { useVideoCurrentTime, useVideoInfo } from './hooks/useVideoElement.ts'

/** Parsing + selectors */
export { fetchAnnotations, parseAnnotations } from './parse.ts'
export { selectLabels, selectPersonTracks, selectShots } from './select.ts'

/** Types + schemas */
export {
    type AnnotationResult,
    annotationResultSchema,
    type DetectedAttribute,
    detectedAttributeSchema,
    type Entity,
    entitySchema,
    type LabelAnnotation,
    labelAnnotationSchema,
    type LabelSegment,
    labelSegmentSchema,
    type Landmark,
    landmarkSchema,
    type NormalizedBoundingBox,
    normalizedBoundingBoxSchema,
    type NormalizedVertex,
    normalizedVertexSchema,
    type PersonDetectionAnnotation,
    personDetectionAnnotationSchema,
    type PersonTrack,
    personTrackSchema,
    type Segment,
    segmentSchema,
    type ShotAnnotation,
    shotAnnotationSchema,
    type TimeOffset,
    timeOffsetSchema,
    type TimestampedObject,
    timestampedObjectSchema,
    type VideoAnnotations,
    videoAnnotationsSchema,
    type VideoInfo,
} from './types.ts'
/** Pure geometry + time helpers */
export {
    type InterpolatedPose,
    type NormalizedBox,
    poseAtTime,
    type ResolvedLandmark,
} from './utils/person.ts'

export { lerp, timeOffsetToSeconds } from './utils/time.ts'
