/**
 * Provider-independent domain model for media annotations.
 *
 * Nothing here is specific to Google Video Intelligence (or any other analysis provider) — adapters normalise provider
 * payloads _into_ these shapes and may stash the untouched original on {@link annotationSchema}'s `raw` field.
 *
 * Two deliberate choices worth knowing before reading further.
 *
 * **Temporal is required, spatial is optional.** Confirmed against real API output: `shot_label_annotations` and
 * `segment_label_annotations` carry no spatial component at all, while `person_detection_annotations` carry both a box
 * and a set of landmark points. Every annotation lives somewhere in time; only some live somewhere on screen.
 *
 * **Both axes are point-or-range.** A playhead and a landmark are points; an in/out selection and a bounding box are
 * ranges. Modelling them as the same primitive on two axes is what lets one query answer "what is here?" uniformly.
 */

import { z } from 'zod'

/** Seconds from the start of the media. Fractional; never negative. */
export const timecodeSchema = z.number().min(0)
export type Timecode = z.infer<typeof timecodeSchema>

/** A normalised (0–1) coordinate, resolution-independent so it survives proxies and re-encodes. */
export const normalizedSchema = z.number().min(0).max(1)

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * Temporal targets — where in time an annotation applies
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Applies to the media item as a whole (no timestamp). */
export const wholeTargetSchema = z.object({
    kind: z.literal('whole'),
})

/** A single instant — a marker, a sampled frame, an Audacity-style point label. */
export const pointTargetSchema = z.object({
    at: timecodeSchema,
    kind: z.literal('point'),
})

/** A time range — a shot, a chapter, a transcript segment, an Audacity-style region label. */
export const intervalTargetSchema = z.object({
    end: timecodeSchema,
    kind: z.literal('interval'),
    start: timecodeSchema,
})

export const temporalTargetSchema = z.discriminatedUnion('kind', [
    wholeTargetSchema,
    pointTargetSchema,
    intervalTargetSchema,
])
export type TemporalTarget = z.infer<typeof temporalTargetSchema>

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * Spatial targets — where on screen an annotation applies (optional)
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** A single normalised point — a pose/face landmark. */
export const spatialPointSchema = z.object({
    kind: z.literal('point'),
    x: normalizedSchema,
    y: normalizedSchema,
})

/** A normalised box — a detection bounding box. Edges are 0–1, origin top-left. */
export const spatialRegionSchema = z.object({
    bottom: normalizedSchema,
    kind: z.literal('region'),
    left: normalizedSchema,
    right: normalizedSchema,
    top: normalizedSchema,
})

export const spatialTargetSchema = z.discriminatedUnion('kind', [
    spatialPointSchema,
    spatialRegionSchema,
])
export type SpatialTarget = z.infer<typeof spatialTargetSchema>

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * Annotation
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Who authored an annotation. Kept explicit so human corrections can sit alongside machine output in one list without
 * either being mistaken for the other.
 */
export const annotationOriginSchema = z.enum([
    'app',
    'human',
    'import',
    'machine',
])
export type AnnotationOrigin = z.infer<typeof annotationOriginSchema>

/**
 * A single piece of information attached to part of a media item.
 *
 * `kind` is an open string rather than an enum on purpose — new annotation types (a rehearsal note, a verse/chorus
 * marker, a stage direction) should not require editing this file. Type-specific data goes in `payload`.
 *
 * `trackId` groups annotations that belong to one continuous subject: the sampled frames of one tracked person, every
 * appearance of one identified face, every note against one rehearsal take. Anything that renders as "a row per
 * subject" reads this field, which is why faces, person-tracking, and take comparison can share one timeline
 * component.
 */
export const annotationSchema = z.object({
    /** Which {@link analysisRunSchema} produced this, when machine-generated. */
    analysisRunId: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    id: z.string(),
    /** Open-ended type discriminator: `label`, `object`, `face`, `transcript`, `shot`, `comment`, … */
    kind: z.string(),
    /** Human-readable text — the entity description, the transcript text, the comment body. */
    label: z.string(),
    mediaId: z.string(),
    origin: annotationOriginSchema,
    /** Type-specific extras. Deliberately untyped here; adapters and consumers narrow it. */
    payload: z.record(z.string(), z.unknown()).optional(),
    /** Untouched provider output, preserved for debugging, reprocessing, and provider-only fields. */
    raw: z.unknown().optional(),
    spatial: spatialTargetSchema.optional(),
    temporal: temporalTargetSchema,
    /** Groups annotations belonging to one continuous subject (one track, one face, one take). */
    trackId: z.string().optional(),
})
export type Annotation = z.infer<typeof annotationSchema>

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * Media
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Where a media item physically lives. A single item may have several (original, proxy, offline archive copy). */
export const mediaSourceSchema = z.object({
    /** Whether this source is reachable right now — offline drives stay catalogued, not deleted. */
    available: z.boolean().default(true),
    kind: z.enum(['cloud', 'drive', 'file', 'network', 'proxy', 'url']),
    locator: z.string(),
})
export type MediaSource = z.infer<typeof mediaSourceSchema>

/**
 * A video, audio recording, image sequence, or blank placeholder.
 *
 * `blank` exists so a stretch of time can be annotated with no underlying recording at all — blocking out choreography
 * before anything has been filmed.
 *
 * `id` is app-level and stable: a file can move drive, be renamed, go offline, or be swapped for a proxy without its
 * annotations detaching.
 */
export const mediaItemSchema = z.object({
    duration: timecodeSchema.optional(),
    id: z.string(),
    kind: z.enum(['audio', 'blank', 'image-sequence', 'video']),
    name: z.string(),
    sources: z.array(mediaSourceSchema).default([]),
})
export type MediaItem = z.infer<typeof mediaItemSchema>

/** A group of related media items — a folder, an event, a set of takes, a saved search. */
export const collectionSchema = z.object({
    id: z.string(),
    kind: z.enum([
        'album',
        'event',
        'folder',
        'project',
        'rehearsal',
        'search',
        'takes',
    ]),
    mediaIds: z.array(z.string()).default([]),
    name: z.string(),
})
export type Collection = z.infer<typeof collectionSchema>

/**
 * One processing operation against one media item. Several runs per item are expected — reprocessing with a newer
 * model, or with a different provider, adds a run rather than replacing annotations.
 */
export const analysisRunSchema = z.object({
    completedAt: z.string().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    createdAt: z.string(),
    error: z.string().optional(),
    id: z.string(),
    mediaId: z.string(),
    provider: z.string(),
    providerVersion: z.string().optional(),
    status: z.enum(['complete', 'error', 'pending', 'running']),
})
export type AnalysisRun = z.infer<typeof analysisRunSchema>

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * Segments
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * A named time range within a media item — a chapter, a shot, a rehearsal section.
 *
 * A segment is a _reference_, not a file. The viewer can play it, annotate it, and list it as a chapter with nothing
 * exported. Generating a standalone clip from it is a separate, optional step; deleting that clip later must not touch
 * the segment or its annotations.
 */
export const mediaSegmentSchema = z.object({
    end: timecodeSchema,
    id: z.string(),
    label: z.string(),
    mediaId: z.string(),
    start: timecodeSchema,
})
export type MediaSegment = z.infer<typeof mediaSegmentSchema>
