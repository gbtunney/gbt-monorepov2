/**
 * A transparent `<canvas>` overlay, sized to fill its (relatively-positioned) parent, that redraws person-detection
 * bounding boxes + landmarks every animation frame from the video's live `currentTime`. Faithful to the original
 * visualiser: blue boxes, red landmark dots, linear interpolation between sampled frames.
 */

import { type CSSProperties, type ReactElement, useEffect, useRef } from 'react'
import { type PersonTrack } from '../types.ts'
import { poseAtTime } from '../utils/person.ts'

export type AnnotationCanvasProps = {
    /** Confidence gate — only tracks with `confidence > threshold` are drawn. */
    threshold: number
    /** Person tracks to render. */
    tracks: Array<PersonTrack>
    /** The video whose `currentTime` drives the overlay. */
    video: HTMLVideoElement | null
}

const BOX_COLOR = '#4285F4'
const LANDMARK_COLOR = '#EA4335'

const overlayStyle: CSSProperties = {
    height: '100%',
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    width: '100%',
}

const AnnotationCanvas = ({
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

            const seconds = video.currentTime
            for (const track of tracks) {
                if ((track.confidence ?? 0) <= threshold) continue
                const pose = poseAtTime(track, seconds)
                if (pose === null) continue

                const x = pose.box.left * width
                const y = pose.box.top * height
                const w = (pose.box.right - pose.box.left) * width
                const h = (pose.box.bottom - pose.box.top) * height

                ctx.lineWidth = 2
                ctx.strokeStyle = BOX_COLOR
                ctx.strokeRect(x, y, w, h)

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

            raf = requestAnimationFrame(draw)
        }
        raf = requestAnimationFrame(draw)

        return (): void => {
            cancelAnimationFrame(raf)
        }
    }, [threshold, tracks, video])

    return <canvas ref={canvasRef} style={overlayStyle} />
}

export default AnnotationCanvas
