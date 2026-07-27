/**
 * Pure rotated-box (polygon) interpolation for text-detection segments. Framework-free so it runs under the plain-node
 * vitest `test` target.
 */

import { lerp, timeOffsetToSeconds } from './time.ts'
import { type Segment, type TextFrame } from '../types.ts'

/** A resolved polygon vertex in normalized (0–1) coordinates. */
export type PolygonVertex = { x: number; y: number }

const verticesOf = (frame: TextFrame): Array<PolygonVertex> =>
    frame.rotated_bounding_box.vertices.map((vertex) => ({
        x: vertex.x ?? 0,
        y: vertex.y ?? 0,
    }))

const lerpVertices = (
    start: Array<PolygonVertex>,
    end: Array<PolygonVertex>,
    ratio: number,
): Array<PolygonVertex> =>
    start.map((vertex, index) => {
        if (index >= end.length) return vertex
        const next = end[index]
        return {
            x: lerp(vertex.x, next.x, ratio),
            y: lerp(vertex.y, next.y, ratio),
        }
    })

/**
 * The interpolated normalized (0–1) polygon for a text segment's `frames` at `seconds`.
 *
 * Returns `null` outside the (optional) `segment` or when there are no frames. Vertices are matched by index and
 * linearly interpolated between the two bracketing frames.
 */
export const polygonAtTime = (
    frames: Array<TextFrame>,
    seconds: number,
    segment?: Segment,
): Array<PolygonVertex> | null => {
    if (frames.length === 0) return null

    const times = frames.map((frame) => timeOffsetToSeconds(frame.time_offset))
    const start = segment?.start_time_offset
        ? timeOffsetToSeconds(segment.start_time_offset)
        : times[0]
    const end = segment?.end_time_offset
        ? timeOffsetToSeconds(segment.end_time_offset)
        : times[times.length - 1]

    if (seconds < start || seconds > end) return null
    if (seconds <= times[0]) return verticesOf(frames[0])

    const lastIndex = frames.length - 1
    if (seconds >= times[lastIndex]) return verticesOf(frames[lastIndex])

    let index = 0
    while (index < lastIndex && times[index + 1] <= seconds) index += 1

    const span = times[index + 1] - times[index]
    const ratio = span > 0 ? (seconds - times[index]) / span : 0

    return lerpVertices(
        verticesOf(frames[index]),
        verticesOf(frames[index + 1]),
        ratio,
    )
}
