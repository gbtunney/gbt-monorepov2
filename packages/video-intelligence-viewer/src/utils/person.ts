/**
 * Pure person-track geometry — framework-free so it runs under the plain-node vitest `test` target.
 *
 * Given a track and a playback time, returns the interpolated normalized (0–1) bounding box + landmarks for that
 * instant, mirroring the linear interpolation the original visualiser does between sampled frames.
 */

import { lerp, timeOffsetToSeconds } from './time.ts'
import { type PersonTrack, type TimestampedObject } from '../types.ts'

/** The interpolated pose of a person track at a given time. */
export type InterpolatedPose = {
    box: NormalizedBox
    landmarks: Array<ResolvedLandmark>
}

/** A normalized (0–1) box at a single instant. */
export type NormalizedBox = {
    bottom: number
    left: number
    right: number
    top: number
}

/** A resolved landmark point in normalized (0–1) coordinates. */
export type ResolvedLandmark = {
    name?: string
    x: number
    y: number
}

const boxOf = (frame: TimestampedObject): NormalizedBox => ({
    bottom: frame.normalized_bounding_box.bottom ?? 0,
    left: frame.normalized_bounding_box.left ?? 0,
    right: frame.normalized_bounding_box.right ?? 0,
    top: frame.normalized_bounding_box.top ?? 0,
})

const landmarksOf = (frame: TimestampedObject): Array<ResolvedLandmark> =>
    (frame.landmarks ?? []).map((landmark) => ({
        name: landmark.name,
        x: landmark.point?.x ?? 0,
        y: landmark.point?.y ?? 0,
    }))

const lerpLandmarks = (
    start: Array<ResolvedLandmark>,
    end: Array<ResolvedLandmark>,
    ratio: number,
): Array<ResolvedLandmark> =>
    // Interpolate by index; landmark ordering is stable across a track's frames.
    start.map((landmark, index) => {
        if (index >= end.length) return landmark
        const next = end[index]
        return {
            name: landmark.name,
            x: lerp(landmark.x, next.x, ratio),
            y: lerp(landmark.y, next.y, ratio),
        }
    })

/**
 * Resolve a person track's box + landmarks at `seconds`.
 *
 * Returns `null` when the time falls outside the track's segment, or the track has no sampled frames. Between two
 * sampled frames the box edges and landmark points are linearly interpolated; before the first / after the last frame
 * the edge frame is used as-is.
 */
export const poseAtTime = (
    track: PersonTrack,
    seconds: number,
): InterpolatedPose | null => {
    const frames = track.timestamped_objects
    if (frames.length === 0) return null

    const times = frames.map((frame) => timeOffsetToSeconds(frame.time_offset))
    const start = track.segment?.start_time_offset
        ? timeOffsetToSeconds(track.segment.start_time_offset)
        : times[0]
    const end = track.segment?.end_time_offset
        ? timeOffsetToSeconds(track.segment.end_time_offset)
        : times[times.length - 1]

    if (seconds < start || seconds > end) return null

    // At or before the first sampled frame.
    if (seconds <= times[0])
        return { box: boxOf(frames[0]), landmarks: landmarksOf(frames[0]) }

    // At or after the last sampled frame.
    const lastIndex = frames.length - 1
    if (seconds >= times[lastIndex])
        return {
            box: boxOf(frames[lastIndex]),
            landmarks: landmarksOf(frames[lastIndex]),
        }

    // Between two frames — find the bracketing pair and interpolate.
    let index = 0
    while (index < lastIndex && times[index + 1] <= seconds) index += 1

    const before = frames[index]
    const after = frames[index + 1]
    const span = times[index + 1] - times[index]
    const ratio = span > 0 ? (seconds - times[index]) / span : 0

    const boxBefore = boxOf(before)
    const boxAfter = boxOf(after)

    return {
        box: {
            bottom: lerp(boxBefore.bottom, boxAfter.bottom, ratio),
            left: lerp(boxBefore.left, boxAfter.left, ratio),
            right: lerp(boxBefore.right, boxAfter.right, ratio),
            top: lerp(boxBefore.top, boxAfter.top, ratio),
        },
        landmarks: lerpLandmarks(
            landmarksOf(before),
            landmarksOf(after),
            ratio,
        ),
    }
}
