/**
 * A transparent `<canvas>` overlay, sized to fill its (relatively-positioned) parent, that redraws detection geometry
 * every animation frame from the video's live `currentTime`. Three layers, each gated by `threshold`: person tracks in
 * blue with red landmark dots, object tracking in green with an entity label, and text in amber as a rotated polygon
 * with the detected string. Frames are linearly interpolated, faithful to the original visualiser.
 */

import { type CSSProperties, type ReactElement, useEffect, useRef } from 'react'
import {
    type ObjectTrackingAnnotation,
    type PersonTrack,
    type TextAnnotation,
} from '../types.ts'
import { boxAtTime } from '../utils/box.ts'
import { poseAtTime } from '../utils/person.ts'
import { polygonAtTime } from '../utils/text.ts'

export type AnnotationCanvasProps = {
    /** Object-tracking annotations (green boxes + entity labels). */
    objectTracks?: Array<ObjectTrackingAnnotation>
    /** Text-detection annotations (amber rotated polygons + the detected string). */
    textItems?: Array<TextAnnotation>
    /** Confidence gate — only detections with `confidence > threshold` are drawn. */
    threshold: number
    /** Person tracks (blue boxes + red landmarks). */
    tracks: Array<PersonTrack>
    /** The video whose `currentTime` drives the overlay. */
    video: HTMLVideoElement | null
}

const PERSON_COLOR = '#4285F4'
const LANDMARK_COLOR = '#EA4335'
const OBJECT_COLOR = '#34A853'
const TEXT_COLOR = '#FBBC05'

// Stable empty defaults so optional array props don't retrigger the draw effect every render.
const NO_OBJECTS: Array<ObjectTrackingAnnotation> = []
const NO_TEXT: Array<TextAnnotation> = []

const overlayStyle: CSSProperties = {
    height: '100%',
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    width: '100%',
}

const label = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    color: string,
): void => {
    ctx.fillStyle = color
    ctx.font = '12px sans-serif'
    ctx.fillText(text, x + 2, Math.max(10, y - 3))
}

const AnnotationCanvas = ({
    objectTracks = NO_OBJECTS,
    textItems = NO_TEXT,
    threshold,
    tracks,
    video,
}: AnnotationCanvasProps): ReactElement => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (canvas === null || video === null) return
        const ctx = canvas.getContext('2d')
        if (ctx === null) return

        let raf = 0
        const draw = (): void => {
            // Match the drawing buffer to the displayed size so boxes stay crisp and correctly scaled.
            const width = canvas.clientWidth
            const height = canvas.clientHeight
            if (canvas.width !== width) canvas.width = width
            if (canvas.height !== height) canvas.height = height

            ctx.clearRect(0, 0, width, height)
            ctx.lineWidth = 2

            const seconds = video.currentTime

            // Person tracks — box + landmark dots.
            for (const track of tracks) {
                if ((track.confidence ?? 0) <= threshold) continue
                const pose = poseAtTime(track, seconds)
                if (pose === null) continue

                ctx.strokeStyle = PERSON_COLOR
                ctx.strokeRect(
                    pose.box.left * width,
                    pose.box.top * height,
                    (pose.box.right - pose.box.left) * width,
                    (pose.box.bottom - pose.box.top) * height,
                )

                ctx.fillStyle = LANDMARK_COLOR
                for (const landmark of pose.landmarks) {
                    ctx.beginPath()
                    ctx.arc(
                        landmark.x * width,
                        landmark.y * height,
                        3,
                        0,
                        Math.PI * 2,
                    )
                    ctx.fill()
                }
            }

            // Object tracking — box + entity label.
            for (const object of objectTracks) {
                if ((object.confidence ?? 0) <= threshold) continue
                const box = boxAtTime(object.frames, seconds, object.segment)
                if (box === null) continue

                const x = box.left * width
                const y = box.top * height
                ctx.strokeStyle = OBJECT_COLOR
                ctx.strokeRect(
                    x,
                    y,
                    (box.right - box.left) * width,
                    (box.bottom - box.top) * height,
                )
                label(ctx, object.entity.description, x, y, OBJECT_COLOR)
            }

            // Text — rotated polygon + the detected string.
            for (const item of textItems) {
                for (const segment of item.segments) {
                    if ((segment.confidence ?? 0) <= threshold) continue
                    const polygon = polygonAtTime(
                        segment.frames,
                        seconds,
                        segment.segment,
                    )
                    if (polygon === null || polygon.length === 0) continue

                    ctx.strokeStyle = TEXT_COLOR
                    ctx.beginPath()
                    ctx.moveTo(polygon[0].x * width, polygon[0].y * height)
                    for (const vertex of polygon.slice(1))
                        ctx.lineTo(vertex.x * width, vertex.y * height)
                    ctx.closePath()
                    ctx.stroke()
                    label(
                        ctx,
                        item.text,
                        polygon[0].x * width,
                        polygon[0].y * height,
                        TEXT_COLOR,
                    )
                }
            }

            raf = requestAnimationFrame(draw)
        }
        raf = requestAnimationFrame(draw)

        return (): void => {
            cancelAnimationFrame(raf)
        }
    }, [objectTracks, textItems, threshold, tracks, video])

    return <canvas ref={canvasRef} style={overlayStyle} />
}

export default AnnotationCanvas
