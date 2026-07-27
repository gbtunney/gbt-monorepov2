/**
 * Pure box interpolation for frame-sampled tracks (object tracking). Framework-free so it runs under the plain-node
 * vitest `test` target. Same bracketing + linear interpolation as `poseAtTime` in ./person.ts, but box-only.
 */

import { type NormalizedBox } from './person.ts'
import { lerp, timeOffsetToSeconds } from './time.ts'
import { type Segment, type TimestampedObject } from '../types.ts'

const boxOf = (frame: TimestampedObject): NormalizedBox => ({
    bottom: frame.normalized_bounding_box.bottom ?? 0,
    left: frame.normalized_bounding_box.left ?? 0,
    right: frame.normalized_bounding_box.right ?? 0,
    top: frame.normalized_bounding_box.top ?? 0,
})

/**
 * The interpolated normalized (0–1) box for a set of sampled `frames` at `seconds`.
 *
 * Returns `null` outside the (optional) `segment`, or when there are no frames. Before the first / after the last frame
 * the edge frame is used; between two frames the edges are linearly interpolated.
 */
export const boxAtTime = (
    frames: Array<TimestampedObject>,
    seconds: number,
    segment?: Segment,
): NormalizedBox | null => {
    if (frames.length === 0) return null

    const times = frames.map((frame) => timeOffsetToSeconds(frame.time_offset))
    const start = segment?.start_time_offset
        ? timeOffsetToSeconds(segment.start_time_offset)
        : times[0]
    const end = segment?.end_time_offset
        ? timeOffsetToSeconds(segment.end_time_offset)
        : times[times.length - 1]

    if (seconds < start || seconds > end) return null
    if (seconds <= times[0]) return boxOf(frames[0])

    const lastIndex = frames.length - 1
    if (seconds >= times[lastIndex]) return boxOf(frames[lastIndex])

    let index = 0
    while (index < lastIndex && times[index + 1] <= seconds) index += 1

    const before = boxOf(frames[index])
    const after = boxOf(frames[index + 1])
    const span = times[index + 1] - times[index]
    const ratio = span > 0 ? (seconds - times[index]) / span : 0

    return {
        bottom: lerp(before.bottom, after.bottom, ratio),
        left: lerp(before.left, after.left, ratio),
        right: lerp(before.right, after.right, ratio),
        top: lerp(before.top, after.top, ratio),
    }
}
