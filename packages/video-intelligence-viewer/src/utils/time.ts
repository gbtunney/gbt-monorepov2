/** Pure time helpers — framework-free so they run under the plain-node vitest `test` target. */

import { type TimeOffset } from '../types.ts'

/**
 * Convert a protobuf `Duration` ({@link TimeOffset}) to floating-point seconds.
 *
 * Null-safe (the original's `nullable_time_offset_to_seconds`): a missing offset — or missing fields within it — counts
 * as `0`, which is how proto3 represents the start of the video. `seconds` may be a numeric string in raw REST JSON.
 */
export const timeOffsetToSeconds = (offset?: null | TimeOffset): number => {
    if (offset === null || offset === undefined) return 0
    const seconds =
        typeof offset.seconds === 'string'
            ? Number.parseFloat(offset.seconds)
            : (offset.seconds ?? 0)
    const nanos = offset.nanos ?? 0
    return (Number.isFinite(seconds) ? seconds : 0) + nanos / 1e9
}

/** Linear interpolation between `start` and `end` by `ratio` (clamped to 0–1). */
export const lerp = (start: number, end: number, ratio: number): number =>
    start + (end - start) * Math.min(1, Math.max(0, ratio))
