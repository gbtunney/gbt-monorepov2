/** Whether a playback time falls inside a frame-sampled detection's active window. Framework-free, unit-testable. */

import { timeOffsetToSeconds } from './time.ts'
import { type Segment, type TimeOffset } from '../types.ts'

/**
 * True when `seconds` is within the detection's time range: the explicit `segment` if present, otherwise the span of
 * the sampled `frames`' `time_offset`s. Cheaper than computing geometry — used by the object/text panels' "currently
 * visible" lists.
 */
export const withinSegment = (
    seconds: number,
    segment: Segment | undefined,
    frames: ReadonlyArray<{ time_offset?: TimeOffset }>,
): boolean => {
    const first = frames[0]
    const last = frames[frames.length - 1]
    const start = segment?.start_time_offset
        ? timeOffsetToSeconds(segment.start_time_offset)
        : timeOffsetToSeconds(first?.time_offset)
    const end = segment?.end_time_offset
        ? timeOffsetToSeconds(segment.end_time_offset)
        : timeOffsetToSeconds(last?.time_offset)
    return seconds >= start && seconds <= end
}
