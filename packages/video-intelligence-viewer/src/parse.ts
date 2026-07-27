/** Parse + validate raw Video Intelligence annotation JSON into a typed {@link VideoAnnotations}. */

import { type VideoAnnotations, videoAnnotationsSchema } from './types.ts'

/**
 * Parse a JSON string of Video Intelligence API annotations.
 *
 * Mirrors the original visualiser's validation: the payload must contain an `annotation_results` key. Throws a friendly
 * `Error` on malformed JSON or a missing/invalid `annotation_results` array so callers (e.g. the file loader) can show
 * the message directly.
 */
export const parseAnnotations = (text: string): VideoAnnotations => {
    let raw: unknown
    try {
        raw = JSON.parse(text)
    } catch (error) {
        throw new Error(
            `Not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
        )
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
