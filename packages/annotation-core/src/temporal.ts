/**
 * Pure helpers for reasoning about {@link TemporalTarget}s: where one starts and ends, whether it covers a playhead,
 * whether it overlaps a selection, and how to shift one between timelines.
 *
 * Framework-free and side-effect-free — every function here is directly unit testable with plain numbers.
 */

import {
    type MediaSegment,
    type TemporalTarget,
    type Timecode,
} from './types.ts'

/**
 * Start of a target in seconds.
 *
 * A `whole` target starts at 0 — it covers everything, so the earliest point it covers is the start of the media.
 */
export const temporalStart = (target: TemporalTarget): Timecode => {
    if (target.kind === 'point') return target.at
    if (target.kind === 'interval') return target.start
    return 0
}

/**
 * End of a target in seconds.
 *
 * A `whole` target has no intrinsic end, so `mediaDuration` supplies one. Without it, `Infinity` is returned — which
 * behaves correctly in every comparison here, and keeps "annotation covering the entire file" working before a
 * `<video>` element has reported its duration.
 */
export const temporalEnd = (
    target: TemporalTarget,
    mediaDuration?: Timecode,
): Timecode => {
    if (target.kind === 'point') return target.at
    if (target.kind === 'interval') return target.end
    return mediaDuration ?? Infinity
}

/** Length in seconds. Points are zero-length. */
export const temporalDuration = (
    target: TemporalTarget,
    mediaDuration?: Timecode,
): Timecode => temporalEnd(target, mediaDuration) - temporalStart(target)

/**
 * Whether a target covers a given instant — the "what is at the playhead?" predicate.
 *
 * Intervals are treated as half-open (`start <= at < end`) so that back-to-back shots do not both claim the frame on
 * their shared boundary. Points match within `tolerance`, since an exact float match against a playhead position would
 * essentially never hit; the default is one frame at 30fps.
 */
export const containsPoint = (
    target: TemporalTarget,
    time: Timecode,
    tolerance: Timecode = 1 / 30,
): boolean => {
    if (target.kind === 'whole') return true
    if (target.kind === 'point') return Math.abs(target.at - time) <= tolerance
    return time >= target.start && time < target.end
}

/**
 * Whether a target overlaps a range at all — the "what is in the current in/out selection?" predicate.
 *
 * Partial overlap counts: a shot that begins before the in-point and runs past it is in the selection.
 */
export const overlapsInterval = (
    target: TemporalTarget,
    start: Timecode,
    end: Timecode,
): boolean => {
    if (target.kind === 'whole') return true
    if (target.kind === 'point') return target.at >= start && target.at <= end
    return target.start < end && target.end > start
}

/**
 * Shift a target along the timeline by `offset` seconds, clamping at zero.
 *
 * `whole` targets are returned unchanged — "the entire file" means the same thing on any timeline.
 */
export const shiftTemporal = (
    target: TemporalTarget,
    offset: Timecode,
): TemporalTarget => {
    const clamp = (value: Timecode): Timecode => Math.max(0, value + offset)
    if (target.kind === 'point') return { at: clamp(target.at), kind: 'point' }
    if (target.kind === 'interval') {
        return {
            end: clamp(target.end),
            kind: 'interval',
            start: clamp(target.start),
        }
    }
    return target
}

/**
 * Convert a target from the source media's absolute timeline into a segment's own 0-based timeline.
 *
 * This is what makes an annotation authored against a two-hour recording still land in the right place inside a
 * ninety-second clip exported from it. Run it when generating a derivative; run {@link rebaseFromSegment} to go back.
 */
export const rebaseToSegment = (
    target: TemporalTarget,
    segment: MediaSegment,
): TemporalTarget => shiftTemporal(target, -segment.start)

/** Inverse of {@link rebaseToSegment} — lift a clip-relative target back onto the source media's timeline. */
export const rebaseFromSegment = (
    target: TemporalTarget,
    segment: MediaSegment,
): TemporalTarget => shiftTemporal(target, segment.start)
