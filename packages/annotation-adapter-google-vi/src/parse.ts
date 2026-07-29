/** Parse + validate raw Google Video Intelligence annotation JSON into a typed {@link VideoAnnotations}. */

import {
    type VideoAnnotations,
    videoAnnotationsSchema,
} from './google-vi-schema.ts'

/**
 * Parse Google Video Intelligence API annotations from a JSON string or an already-parsed object.
 *
 * Mirrors the original visualiser's validation: the payload must contain an `annotation_results` key. Throws a friendly
 * `Error` on malformed JSON or a missing/invalid `annotation_results` array so callers can surface the message
 * directly.
 */
export const parseGoogleVi = (input: unknown): VideoAnnotations => {
    let raw: unknown
    if (typeof input === 'string') {
        try {
            raw = JSON.parse(input)
        } catch (error) {
            throw new Error(
                `Not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
                { cause: error },
            )
        }
    } else {
        raw = input
    }

    if (
        raw === null ||
        typeof raw !== 'object' ||
        !('annotation_results' in raw)
    )
        throw new Error(
            'Missing "annotation_results" — expected Video Intelligence API output (snake_case JSON).',
        )

    const result = videoAnnotationsSchema.safeParse(raw)
    if (!result.success)
        throw new Error(
            `Invalid annotation data: ${result.error.issues[0]?.message ?? 'unknown validation error'}`,
        )

    return result.data
}
