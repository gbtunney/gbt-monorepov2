/**
 * Curated Zod schemas for the Google Cloud Video Intelligence API annotation JSON.
 *
 * These mirror the **snake_case** REST / `gcloud` output shape (`annotation_results`, `time_offset`,
 * `normalized_bounding_box`, `{ seconds, nanos }` durations) — the format the raw data dumps and the original
 * [video-intelligence-api-visualiser](https://github.com/ZackAkil/video-intelligence-api-visualiser) consume.
 *
 * This is the _curated_ half of the adapter's schema strategy: a thin, hand-maintained schema covering only the
 * features actually normalised below, matching the data on hand and carrying the domain knowledge a generic generator
 * cannot infer (missing `time_offset` means `0s`; `seconds` may be a numeric string). Unknown keys are stripped, so
 * real payloads carrying every other feature still validate. See the README for the deferred _reference_ half (a schema
 * generated from Google's `.proto` for drift-detection).
 */

import { z } from 'zod'

/**
 * A protobuf `Duration`. Both fields are optional — proto3 omits zero-valued fields, so a missing `time_offset` means
 * `0s` (start of the video). `seconds` may arrive as a string in raw REST JSON.
 *
 * @see timeOffsetToSeconds in ./time.ts
 */
export const timeOffsetSchema = z.object({
    nanos: z.number().optional(),
    seconds: z.union([z.number(), z.string()]).optional(),
})
export type TimeOffset = z.infer<typeof timeOffsetSchema>

/** Normalized (0–1) bounding box. Any edge may be omitted (proto3 zero) and is treated as `0`. */
export const normalizedBoundingBoxSchema = z.object({
    bottom: z.number().optional(),
    left: z.number().optional(),
    right: z.number().optional(),
    top: z.number().optional(),
})
export type NormalizedBoundingBox = z.infer<typeof normalizedBoundingBoxSchema>

/** A detected entity (label / object / person class). */
export const entitySchema = z.object({
    description: z.string(),
    entity_id: z.string().optional(),
    language_code: z.string().optional(),
})
export type Entity = z.infer<typeof entitySchema>

/** A normalized (0–1) point, used by person landmarks. */
export const normalizedVertexSchema = z.object({
    x: z.number().optional(),
    y: z.number().optional(),
})
export type NormalizedVertex = z.infer<typeof normalizedVertexSchema>

/** A named body/face landmark at a single frame. */
export const landmarkSchema = z.object({
    confidence: z.number().optional(),
    name: z.string().optional(),
    point: normalizedVertexSchema.optional(),
})
export type Landmark = z.infer<typeof landmarkSchema>

/** A detected attribute (e.g. `clothing_color`) at a single frame. */
export const detectedAttributeSchema = z.object({
    confidence: z.number().optional(),
    name: z.string().optional(),
    value: z.string().optional(),
})
export type DetectedAttribute = z.infer<typeof detectedAttributeSchema>

/** A time range within the video (Google's `VideoSegment` shape). */
export const googleSegmentSchema = z.object({
    end_time_offset: timeOffsetSchema.optional(),
    start_time_offset: timeOffsetSchema.optional(),
})
export type GoogleSegment = z.infer<typeof googleSegmentSchema>

/** One sampled frame of a person/object track: a box (+ optional landmarks/attributes) at `time_offset`. */
export const timestampedObjectSchema = z.object({
    attributes: z.array(detectedAttributeSchema).optional(),
    landmarks: z.array(landmarkSchema).optional(),
    normalized_bounding_box: normalizedBoundingBoxSchema,
    time_offset: timeOffsetSchema.optional(),
})
export type TimestampedObject = z.infer<typeof timestampedObjectSchema>

/** One tracked person: a segment + the sampled frames that make up its motion. */
export const personTrackSchema = z.object({
    attributes: z.array(detectedAttributeSchema).optional(),
    confidence: z.number().optional(),
    segment: googleSegmentSchema.optional(),
    timestamped_objects: z.array(timestampedObjectSchema).default([]),
})
export type PersonTrack = z.infer<typeof personTrackSchema>

/** Person detection annotation: a collection of tracks. */
export const personDetectionAnnotationSchema = z.object({
    tracks: z.array(personTrackSchema).default([]),
})
export type PersonDetectionAnnotation = z.infer<
    typeof personDetectionAnnotationSchema
>

/**
 * Object tracking annotation: an entity tracked across sampled box frames. Structurally a person track without
 * landmarks, so the frames reuse {@link timestampedObjectSchema}.
 */
export const objectTrackingAnnotationSchema = z.object({
    confidence: z.number().optional(),
    entity: entitySchema,
    frames: z.array(timestampedObjectSchema).default([]),
    segment: googleSegmentSchema.optional(),
})
export type ObjectTrackingAnnotation = z.infer<
    typeof objectTrackingAnnotationSchema
>

/** A single confidence-scored segment of a label. */
export const labelSegmentSchema = z.object({
    confidence: z.number().optional(),
    segment: googleSegmentSchema.optional(),
})
export type LabelSegment = z.infer<typeof labelSegmentSchema>

/** Label detection annotation (shot- or segment-level). */
export const labelAnnotationSchema = z.object({
    category_entities: z.array(entitySchema).optional(),
    entity: entitySchema,
    segments: z.array(labelSegmentSchema).default([]),
})
export type LabelAnnotation = z.infer<typeof labelAnnotationSchema>

/** Shot change annotation: a single detected shot's time range. */
export const shotAnnotationSchema = googleSegmentSchema
export type ShotAnnotation = GoogleSegment

/** A single transcribed word with its own time range. Note the `start_time`/`end_time` naming (not `_offset`). */
export const speechWordSchema = z.object({
    end_time: timeOffsetSchema.optional(),
    speaker_tag: z.number().optional(),
    start_time: timeOffsetSchema.optional(),
    word: z.string(),
})
export type SpeechWord = z.infer<typeof speechWordSchema>

/** One transcription hypothesis: the transcript text, its confidence, and per-word timings. */
export const speechAlternativeSchema = z.object({
    confidence: z.number().optional(),
    transcript: z.string().optional(),
    words: z.array(speechWordSchema).default([]),
})
export type SpeechAlternative = z.infer<typeof speechAlternativeSchema>

/** Speech transcription annotation: alternatives for one spoken segment (the first is the best). */
export const speechTranscriptionSchema = z.object({
    alternatives: z.array(speechAlternativeSchema).default([]),
    language_code: z.string().optional(),
})
export type SpeechTranscriptionAnnotation = z.infer<
    typeof speechTranscriptionSchema
>

/** A rotated (not necessarily axis-aligned) bounding box: an ordered ring of normalized vertices. */
export const rotatedBoundingBoxSchema = z.object({
    vertices: z.array(normalizedVertexSchema).default([]),
})
export type RotatedBoundingBox = z.infer<typeof rotatedBoundingBoxSchema>

/** One sampled frame of a text segment: the rotated box at `time_offset`. */
export const textFrameSchema = z.object({
    rotated_bounding_box: rotatedBoundingBoxSchema,
    time_offset: timeOffsetSchema.optional(),
})
export type TextFrame = z.infer<typeof textFrameSchema>

/** One appearance of a piece of text: a time range + the sampled rotated-box frames. */
export const textSegmentSchema = z.object({
    confidence: z.number().optional(),
    frames: z.array(textFrameSchema).default([]),
    segment: googleSegmentSchema.optional(),
})
export type TextSegment = z.infer<typeof textSegmentSchema>

/** Text detection annotation: a detected string and every segment where it appears. */
export const textAnnotationSchema = z.object({
    segments: z.array(textSegmentSchema).default([]),
    text: z.string(),
})
export type TextAnnotation = z.infer<typeof textAnnotationSchema>

/**
 * One sampled frame of explicit-content detection: a whole-frame likelihood rating at `time_offset`.
 * `pornography_likelihood` is one of the `Likelihood` enum strings (kept as a plain string so unknown values
 * validate).
 */
export const explicitFrameSchema = z.object({
    pornography_likelihood: z.string().optional(),
    time_offset: timeOffsetSchema.optional(),
})
export type ExplicitFrame = z.infer<typeof explicitFrameSchema>

/** Explicit content detection: a single object (not an array) with per-frame likelihood ratings. */
export const explicitAnnotationSchema = z.object({
    frames: z.array(explicitFrameSchema).default([]),
})
export type ExplicitAnnotation = z.infer<typeof explicitAnnotationSchema>

/** One `annotation_results` entry. Every feature list is optional; unknown keys are stripped. */
export const annotationResultSchema = z.object({
    explicit_annotation: explicitAnnotationSchema.optional(),
    input_uri: z.string().optional(),
    object_annotations: z.array(objectTrackingAnnotationSchema).optional(),
    person_detection_annotations: z
        .array(personDetectionAnnotationSchema)
        .optional(),
    segment_label_annotations: z.array(labelAnnotationSchema).optional(),
    shot_annotations: z.array(shotAnnotationSchema).optional(),
    shot_label_annotations: z.array(labelAnnotationSchema).optional(),
    speech_transcriptions: z.array(speechTranscriptionSchema).optional(),
    text_annotations: z.array(textAnnotationSchema).optional(),
})
export type AnnotationResult = z.infer<typeof annotationResultSchema>

/** Top-level Video Intelligence response. */
export const videoAnnotationsSchema = z.object({
    annotation_results: z.array(annotationResultSchema).default([]),
})
export type VideoAnnotations = z.infer<typeof videoAnnotationsSchema>
