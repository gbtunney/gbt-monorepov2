/**
 * Normalise Google Video Intelligence output into the provider-neutral `@snailicid3/annotation-core` model.
 *
 * Every Google feature becomes a flat list of {@link Annotation}s so the core query layer can answer "what is at this
 * point / in this range?" uniformly, regardless of provider. Two collation rules from the API carry through.
 *
 * **Labels dedupe by name.** Every occurrence of one label description shares a `trackId` (`label:<desc>`), so a viewer
 * renders one row per label with its occurrences underneath.
 *
 * **Objects do not dedupe.** Every tracked instance is its own record with a unique `trackId`, even when two instances
 * share an entity description — matching the API, where a second "person" is a separate track.
 *
 * The untouched Google sub-object is preserved on each annotation's `raw` field for debugging, reprocessing, and access
 * to provider-only fields (per-frame boxes, landmarks, word timings) that the flat model does not surface.
 */

import {
    type AnalysisRun,
    type Annotation,
    type TemporalTarget,
} from '@snailicid3/annotation-core'

import {
    type AnnotationResult,
    type GoogleSegment,
    type LabelAnnotation,
    type TextAnnotation,
    type TimestampedObject,
    type VideoAnnotations,
} from './google-vi-schema.ts'
import { parseGoogleVi } from './parse.ts'
import { timeOffsetToSeconds } from './time.ts'

/** Options controlling how a payload is normalised. `mediaId` ties every annotation to its media item. */
export type GoogleViAdapterOptions = {
    /** Reuse an existing analysis-run id; defaults to `<mediaId>:google-vi`. */
    analysisRunId?: string
    /** ISO timestamp for the synthesised {@link AnalysisRun}; defaults to now. Pass it for deterministic output. */
    createdAt?: string
    /** Stable app-level id of the media item these annotations describe. */
    mediaId: string
    /** Provider label recorded on the run; defaults to `google-video-intelligence`. */
    provider?: string
    /** Model/API version recorded on the run, when known. */
    providerVersion?: string
}

/** What {@link adaptGoogleVideoIntelligence} returns: the normalised annotations plus the run that produced them. */
export type GoogleViAdaptResult = {
    analysisRun: AnalysisRun
    annotations: Array<Annotation>
}

/** The Video Intelligence likelihood enum, ordered least → most likely; index doubles as the ordinal `level`. */
const LIKELIHOODS = [
    'LIKELIHOOD_UNSPECIFIED',
    'VERY_UNLIKELY',
    'UNLIKELY',
    'POSSIBLE',
    'LIKELY',
    'VERY_LIKELY',
] as const

/** Fields every normalised annotation shares within a single adapt call. */
type AnnotationBase = {
    analysisRunId: string
    mediaId: string
    origin: 'machine'
}

/** Build a deterministic `:`-joined id, stringifying numeric parts (the repo forbids numbers in template literals). */
const joinId = (...parts: Array<number | string>): string =>
    parts.map((part) => String(part)).join(':')

/** A time range as an `interval`, or a `point` when it collapses to a single instant (avoids zero-length intervals). */
const temporalOf = (start: number, end: number): TemporalTarget =>
    end > start
        ? { end, kind: 'interval', start }
        : { at: start, kind: 'point' }

/** Resolve a start/end span from an explicit segment, falling back to the min/max of sampled frame times. */
const spanOf = (
    segment: GoogleSegment | undefined,
    frameTimes: Array<number>,
): { end: number; start: number } => {
    const start =
        segment?.start_time_offset === undefined
            ? frameTimes.length > 0
                ? Math.min(...frameTimes)
                : 0
            : timeOffsetToSeconds(segment.start_time_offset)
    const end =
        segment?.end_time_offset === undefined
            ? frameTimes.length > 0
                ? Math.max(...frameTimes)
                : start
            : timeOffsetToSeconds(segment.end_time_offset)
    return { end, start }
}

const boxOf = (frame: TimestampedObject): Record<string, number> => ({
    bottom: frame.normalized_bounding_box.bottom ?? 0,
    left: frame.normalized_bounding_box.left ?? 0,
    right: frame.normalized_bounding_box.right ?? 0,
    top: frame.normalized_bounding_box.top ?? 0,
})

const landmarksOf = (
    frame: TimestampedObject,
): Array<Record<string, unknown>> =>
    (frame.landmarks ?? []).map((landmark) => ({
        name: landmark.name,
        x: landmark.point?.x ?? 0,
        y: landmark.point?.y ?? 0,
    }))

/** Assemble an annotation, including the optional fields only when they carry a value. */
const makeAnnotation = (
    required: Pick<
        Annotation,
        | 'analysisRunId'
        | 'id'
        | 'kind'
        | 'label'
        | 'mediaId'
        | 'origin'
        | 'raw'
        | 'temporal'
    >,
    optional: {
        confidence?: number
        payload?: Record<string, unknown>
        trackId?: string
    } = {},
): Annotation => ({
    ...required,
    ...(optional.confidence === undefined
        ? {}
        : { confidence: optional.confidence }),
    ...(optional.payload === undefined ? {} : { payload: optional.payload }),
    ...(optional.trackId === undefined ? {} : { trackId: optional.trackId }),
})

/** Shot- and segment-level labels. One annotation per (label, occurrence); occurrences of a name share a `trackId`. */
const labelsOf = (
    result: AnnotationResult,
    resultIndex: number,
    base: AnnotationBase,
): Array<Annotation> => {
    const scopes: Array<{ list: Array<LabelAnnotation>; scope: string }> = [
        { list: result.shot_label_annotations ?? [], scope: 'shot' },
        { list: result.segment_label_annotations ?? [], scope: 'segment' },
    ]

    return scopes.flatMap(({ list, scope }) =>
        list.flatMap((label, labelIndex) => {
            const categories = (label.category_entities ?? []).map(
                (entity) => entity.description,
            )
            return label.segments.map((segment, segmentIndex) => {
                const { end, start } = spanOf(segment.segment, [])
                return makeAnnotation(
                    {
                        ...base,
                        id: joinId(
                            'g',
                            resultIndex,
                            'label',
                            scope,
                            labelIndex,
                            segmentIndex,
                        ),
                        kind: 'label',
                        label: label.entity.description,
                        raw: label,
                        temporal: temporalOf(start, end),
                    },
                    {
                        confidence: segment.confidence,
                        payload: { categories, scope },
                        trackId: `label:${label.entity.description}`,
                    },
                )
            })
        }),
    )
}

/** Object tracks — no dedupe: every instance gets a unique `trackId`, even when descriptions match. */
const objectsOf = (
    result: AnnotationResult,
    resultIndex: number,
    base: AnnotationBase,
): Array<Annotation> =>
    (result.object_annotations ?? []).map((object, objectIndex) => {
        const frameTimes = object.frames.map((frame) =>
            timeOffsetToSeconds(frame.time_offset),
        )
        const { end, start } = spanOf(object.segment, frameTimes)
        return makeAnnotation(
            {
                ...base,
                id: joinId('g', resultIndex, 'object', objectIndex),
                kind: 'object',
                label: object.entity.description,
                raw: object,
                temporal: temporalOf(start, end),
            },
            {
                confidence: object.confidence,
                payload: {
                    frames: object.frames.map((frame) => ({
                        box: boxOf(frame),
                        time: timeOffsetToSeconds(frame.time_offset),
                    })),
                },
                trackId: joinId('object', resultIndex, objectIndex),
            },
        )
    })

/** Person detection tracks — one annotation per track, carrying its sampled boxes + landmarks in `payload`. */
const personsOf = (
    result: AnnotationResult,
    resultIndex: number,
    base: AnnotationBase,
): Array<Annotation> =>
    (result.person_detection_annotations ?? []).flatMap(
        (detection, detectionIndex) =>
            detection.tracks.map((track, trackIndex) => {
                const frameTimes = track.timestamped_objects.map((frame) =>
                    timeOffsetToSeconds(frame.time_offset),
                )
                const { end, start } = spanOf(track.segment, frameTimes)
                return makeAnnotation(
                    {
                        ...base,
                        id: joinId(
                            'g',
                            resultIndex,
                            'person',
                            detectionIndex,
                            trackIndex,
                        ),
                        kind: 'person',
                        label: 'person',
                        raw: track,
                        temporal: temporalOf(start, end),
                    },
                    {
                        confidence: track.confidence,
                        payload: {
                            frames: track.timestamped_objects.map((frame) => ({
                                box: boxOf(frame),
                                landmarks: landmarksOf(frame),
                                time: timeOffsetToSeconds(frame.time_offset),
                            })),
                        },
                        trackId: joinId(
                            'person',
                            resultIndex,
                            detectionIndex,
                            trackIndex,
                        ),
                    },
                )
            }),
    )

/** Shot/scene boundaries — plain intervals, the raw material for a chapter list. */
const shotsOf = (
    result: AnnotationResult,
    resultIndex: number,
    base: AnnotationBase,
): Array<Annotation> =>
    (result.shot_annotations ?? []).map((shot, shotIndex) => {
        const start = timeOffsetToSeconds(shot.start_time_offset)
        const end = timeOffsetToSeconds(shot.end_time_offset)
        return makeAnnotation({
            ...base,
            id: joinId('g', resultIndex, 'shot', shotIndex),
            kind: 'shot',
            label: `Shot ${String(shotIndex + 1)}`,
            raw: shot,
            temporal: temporalOf(start, end),
        })
    })

/** Detected on-screen text — one annotation per appearance; appearances of a string share a `trackId`. */
const textsOf = (
    result: AnnotationResult,
    resultIndex: number,
    base: AnnotationBase,
): Array<Annotation> =>
    (result.text_annotations ?? []).flatMap((text: TextAnnotation, textIndex) =>
        text.segments.map((segment, segmentIndex) => {
            const frameTimes = segment.frames.map((frame) =>
                timeOffsetToSeconds(frame.time_offset),
            )
            const { end, start } = spanOf(segment.segment, frameTimes)
            return makeAnnotation(
                {
                    ...base,
                    id: joinId(
                        'g',
                        resultIndex,
                        'text',
                        textIndex,
                        segmentIndex,
                    ),
                    kind: 'text',
                    label: text.text,
                    raw: segment,
                    temporal: temporalOf(start, end),
                },
                {
                    confidence: segment.confidence,
                    payload: {
                        frames: segment.frames.map((frame) => ({
                            time: timeOffsetToSeconds(frame.time_offset),
                            vertices: frame.rotated_bounding_box.vertices.map(
                                (vertex) => ({
                                    x: vertex.x ?? 0,
                                    y: vertex.y ?? 0,
                                }),
                            ),
                        })),
                    },
                    trackId: `text:${text.text}`,
                },
            )
        }),
    )

/** Speech transcription — the best (first) alternative, spanning its word timings. */
const transcriptsOf = (
    result: AnnotationResult,
    resultIndex: number,
    base: AnnotationBase,
): Array<Annotation> =>
    (result.speech_transcriptions ?? []).flatMap(
        (transcription, transcriptionIndex) => {
            if (transcription.alternatives.length === 0) return []
            const alternative = transcription.alternatives[0]

            const words = alternative.words
            const transcript =
                alternative.transcript ??
                words.map((word) => word.word).join(' ')
            const temporal: TemporalTarget =
                words.length > 0
                    ? temporalOf(
                          Math.min(
                              ...words.map((word) =>
                                  timeOffsetToSeconds(word.start_time),
                              ),
                          ),
                          Math.max(
                              ...words.map((word) =>
                                  timeOffsetToSeconds(word.end_time),
                              ),
                          ),
                      )
                    : { kind: 'whole' }

            return [
                makeAnnotation(
                    {
                        ...base,
                        id: joinId(
                            'g',
                            resultIndex,
                            'transcript',
                            transcriptionIndex,
                        ),
                        kind: 'transcript',
                        label: transcript,
                        raw: transcription,
                        temporal,
                    },
                    {
                        confidence: alternative.confidence,
                        payload: {
                            words: words.map((word) => ({
                                end: timeOffsetToSeconds(word.end_time),
                                start: timeOffsetToSeconds(word.start_time),
                                text: word.word,
                            })),
                        },
                        trackId: joinId(
                            'transcript',
                            resultIndex,
                            transcriptionIndex,
                        ),
                    },
                ),
            ]
        },
    )

/** Explicit-content ratings — a step function of point-in-time likelihoods, one annotation per sampled frame. */
const explicitOf = (
    result: AnnotationResult,
    resultIndex: number,
    base: AnnotationBase,
): Array<Annotation> =>
    (result.explicit_annotation?.frames ?? []).map((frame, frameIndex) => {
        const likelihood =
            frame.pornography_likelihood ?? 'LIKELIHOOD_UNSPECIFIED'
        const level = Math.max(
            0,
            (LIKELIHOODS as ReadonlyArray<string>).indexOf(likelihood),
        )
        return makeAnnotation(
            {
                ...base,
                id: joinId('g', resultIndex, 'explicit', frameIndex),
                kind: 'explicit',
                label: likelihood,
                raw: frame,
                temporal: {
                    at: timeOffsetToSeconds(frame.time_offset),
                    kind: 'point',
                },
            },
            { payload: { level }, trackId: 'explicit' },
        )
    })

/**
 * Adapt Google Video Intelligence output (a JSON string, or an already-parsed object) into annotation-core annotations
 * plus the {@link AnalysisRun} that produced them. Throws (via {@link parseGoogleVi}) on malformed input.
 */
export const adaptGoogleVideoIntelligence = (
    input: unknown,
    options: GoogleViAdapterOptions,
): GoogleViAdaptResult => {
    const data: VideoAnnotations = parseGoogleVi(input)
    const { mediaId } = options
    const analysisRunId = options.analysisRunId ?? `${mediaId}:google-vi`

    const analysisRun: AnalysisRun = {
        createdAt: options.createdAt ?? new Date().toISOString(),
        id: analysisRunId,
        mediaId,
        provider: options.provider ?? 'google-video-intelligence',
        status: 'complete',
        ...(options.providerVersion === undefined
            ? {}
            : { providerVersion: options.providerVersion }),
    }

    const base: AnnotationBase = { analysisRunId, mediaId, origin: 'machine' }

    const annotations = data.annotation_results.flatMap(
        (result, resultIndex) => [
            ...labelsOf(result, resultIndex, base),
            ...objectsOf(result, resultIndex, base),
            ...personsOf(result, resultIndex, base),
            ...shotsOf(result, resultIndex, base),
            ...textsOf(result, resultIndex, base),
            ...transcriptsOf(result, resultIndex, base),
            ...explicitOf(result, resultIndex, base),
        ],
    )

    return { analysisRun, annotations }
}
