/**
 * The query layer: narrowing a flat list of annotations down to what should be on screen.
 *
 * Every filter is a plain function over a plain array, so the whole thing is testable without a video element, a React
 * tree, or a fixture larger than a few lines. {@link queryAnnotations} composes them in the order the UI implies.
 */

import { containsPoint, overlapsInterval } from './temporal.ts'
import { type Annotation, type Timecode } from './types.ts'

/** Annotations covering a single instant — the playhead list, and the source for a static box overlay. */
export const annotationsAt = (
    annotations: Array<Annotation>,
    time: Timecode,
    tolerance?: Timecode,
): Array<Annotation> =>
    annotations.filter((annotation) =>
        containsPoint(annotation.temporal, time, tolerance),
    )

/** Annotations overlapping a range — the in/out selection filter. */
export const annotationsWithin = (
    annotations: Array<Annotation>,
    start: Timecode,
    end: Timecode,
): Array<Annotation> =>
    annotations.filter((annotation) =>
        overlapsInterval(annotation.temporal, start, end),
    )

/**
 * Annotations within a confidence band.
 *
 * Annotations with no confidence at all are kept: a human comment has no score, and filtering it out because a slider
 * moved would silently delete the user's own work from the view.
 */
export const byConfidence = (
    annotations: Array<Annotation>,
    min = 0,
    max = 1,
): Array<Annotation> =>
    annotations.filter(
        (annotation) =>
            annotation.confidence === undefined ||
            (annotation.confidence >= min && annotation.confidence <= max),
    )

/** Case-insensitive substring match against the annotation label. Empty queries match everything. */
export const byText = (
    annotations: Array<Annotation>,
    query: string,
): Array<Annotation> => {
    const needle = query.trim().toLowerCase()
    if (needle.length === 0) return annotations
    return annotations.filter((annotation) =>
        annotation.label.toLowerCase().includes(needle),
    )
}

/** Restrict to a set of annotation kinds — the track show/hide toggles. */
export const byKind = (
    annotations: Array<Annotation>,
    kinds: Array<string>,
): Array<Annotation> =>
    annotations.filter((annotation) => kinds.includes(annotation.kind))

/** How many annotations of each kind, for the track badges. */
export const countsByKind = (
    annotations: Array<Annotation>,
): Record<string, number> =>
    annotations.reduce<Record<string, number>>((counts, annotation) => {
        counts[annotation.kind] = (counts[annotation.kind] ?? 0) + 1
        return counts
    }, {})

/**
 * Group annotations by `trackId` — one entry per continuous subject.
 *
 * This is the input for anything that renders a row per subject: per-person face timelines, object tracks, and
 * eventually one row per rehearsal take. Annotations with no `trackId` are collected under `null`.
 */
export const groupByTrack = (
    annotations: Array<Annotation>,
): Map<null | string, Array<Annotation>> =>
    annotations.reduce<Map<null | string, Array<Annotation>>>(
        (groups, annotation) => {
            const key = annotation.trackId ?? null
            const existing = groups.get(key)
            if (existing === undefined) groups.set(key, [annotation])
            else existing.push(annotation)
            return groups
        },
        new Map(),
    )

/** The filter state a viewer holds. Every field is optional; omitting one means "do not narrow on this axis". */
export type AnnotationFilter = {
    /** Playhead position. Applied instead of `range` when both are absent from the UI. */
    at?: Timecode
    /** Upper confidence bound (0–1). */
    confidenceMax?: number
    /** Lower confidence bound (0–1). */
    confidenceMin?: number
    /** Visible annotation kinds. Omitted means all kinds are visible. */
    kinds?: Array<string>
    /** In/out selection as `[start, end]` seconds. */
    range?: [Timecode, Timecode]
    /** Free-text label search. */
    text?: string
}

/** What {@link queryAnnotations} hands back. */
export type AnnotationQueryResult = {
    /**
     * Per-kind counts _before_ the kind visibility filter is applied, but _after_ range, confidence, and text.
     *
     * This is the number a track badge should show. Counting after the visibility filter would zero out the badge of
     * any track you just hid, which is exactly when you most want to know how much is hidden.
     */
    counts: Record<string, number>
    /** The annotations that survived every filter — what actually renders. */
    items: Array<Annotation>
    /** {@link items} grouped by `trackId`, ready for per-subject timeline rows. */
    tracks: Map<null | string, Array<Annotation>>
}

/**
 * Apply a whole filter state at once.
 *
 * Order matters: temporal narrowing runs first (it is the cheapest and usually the most selective), then confidence,
 * then text. Counts are snapshotted at that point, and only then are hidden kinds dropped — see
 * {@link AnnotationQueryResult.counts}.
 */
export const queryAnnotations = (
    annotations: Array<Annotation>,
    filter: AnnotationFilter = {},
): AnnotationQueryResult => {
    let items = annotations

    if (filter.range !== undefined) {
        items = annotationsWithin(items, filter.range[0], filter.range[1])
    } else if (filter.at !== undefined) {
        items = annotationsAt(items, filter.at)
    }

    items = byConfidence(items, filter.confidenceMin, filter.confidenceMax)

    if (filter.text !== undefined) items = byText(items, filter.text)

    const counts = countsByKind(items)

    if (filter.kinds !== undefined) items = byKind(items, filter.kinds)

    return { counts, items, tracks: groupByTrack(items) }
}
