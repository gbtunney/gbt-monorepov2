/** Public API barrel for `@snailicid3/video-intelligence-viewer` */

/** Overlay + panels */
export {
    default as AnnotationCanvas,
    type AnnotationCanvasProps,
} from './components/AnnotationCanvas.tsx'

export {
    default as AnnotationExplorer,
    type AnnotationExplorerProps,
} from './components/AnnotationExplorer.tsx'

export {
    default as ConfidenceSlider,
    type ConfidenceSliderProps,
} from './components/ConfidenceSlider.tsx'
export {
    default as ExplicitContentPanel,
    type ExplicitContentPanelProps,
} from './components/ExplicitContentPanel.tsx'
export {
    default as FileLoader,
    type FileLoaderProps,
} from './components/FileLoader.tsx'
export {
    default as LabelTimeline,
    type LabelTimelineProps,
} from './components/LabelTimeline.tsx'
export {
    default as ObjectPanel,
    type ObjectPanelProps,
} from './components/ObjectPanel.tsx'
export {
    default as ShotTimeline,
    type ShotTimelineProps,
} from './components/ShotTimeline.tsx'
export {
    default as SpeechTranscription,
    type SpeechTranscriptionProps,
} from './components/SpeechTranscription.tsx'
export {
    default as TextPanel,
    type TextPanelProps,
} from './components/TextPanel.tsx'
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
export {
    type ExplicitFrameTiming,
    selectExplicitFrames,
    selectLabels,
    selectObjectTracks,
    selectPersonTracks,
    selectShots,
    selectSpeech,
    selectText,
    type SpeechSegment,
    type SpeechWordTiming,
} from './select.ts'

/** Types + schemas */
export {
    type AnnotationResult,
    annotationResultSchema,
    type DetectedAttribute,
    detectedAttributeSchema,
    type Entity,
    entitySchema,
    type ExplicitAnnotation,
    explicitAnnotationSchema,
    type ExplicitFrame,
    explicitFrameSchema,
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
    type ObjectTrackingAnnotation,
    objectTrackingAnnotationSchema,
    type PersonDetectionAnnotation,
    personDetectionAnnotationSchema,
    type PersonTrack,
    personTrackSchema,
    type RotatedBoundingBox,
    rotatedBoundingBoxSchema,
    type Segment,
    segmentSchema,
    type ShotAnnotation,
    shotAnnotationSchema,
    type SpeechAlternative,
    speechAlternativeSchema,
    type SpeechTranscriptionAnnotation,
    speechTranscriptionSchema,
    type SpeechWord,
    speechWordSchema,
    type TextAnnotation,
    textAnnotationSchema,
    type TextFrame,
    textFrameSchema,
    type TextSegment,
    textSegmentSchema,
    type TimeOffset,
    timeOffsetSchema,
    type TimestampedObject,
    timestampedObjectSchema,
    type VideoAnnotations,
    videoAnnotationsSchema,
    type VideoInfo,
} from './types.ts'
/** Pure geometry + time helpers */
export { boxAtTime } from './utils/box.ts'
export {
    type Likelihood,
    likelihoodAtTime,
    likelihoodColor,
    likelihoodLevel,
    LIKELIHOODS,
} from './utils/likelihood.ts'
export {
    type InterpolatedPose,
    type NormalizedBox,
    poseAtTime,
    type ResolvedLandmark,
} from './utils/person.ts'
export { withinSegment } from './utils/range.ts'
export { polygonAtTime, type PolygonVertex } from './utils/text.ts'
export { lerp, timeOffsetToSeconds } from './utils/time.ts'
