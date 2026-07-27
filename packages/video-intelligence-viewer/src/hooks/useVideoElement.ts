/** React hooks for observing a `<video>` element: its live playback time and its intrinsic geometry. */

import { useEffect, useState } from 'react'
import { type VideoInfo } from '../types.ts'

/**
 * Track a video's `currentTime` as React state. Updates every animation frame while playing (so bound
 * overlays/timelines stay in sync), plus on `seeked`/`timeupdate`, and only re-renders when the time actually moves —
 * keeping the timeline panels' render rate sane.
 */
export const useVideoCurrentTime = (video: HTMLVideoElement | null): number => {
    const [time, setTime] = useState(0)

    useEffect(() => {
        if (video === null) return

        let raf = 0
        let last = -1
        const publish = (): void => {
            if (Math.abs(video.currentTime - last) >= 0.02) {
                last = video.currentTime
                setTime(video.currentTime)
            }
        }
        const loop = (): void => {
            publish()
            raf = requestAnimationFrame(loop)
        }
        const start = (): void => {
            cancelAnimationFrame(raf)
            raf = requestAnimationFrame(loop)
        }
        const stop = (): void => {
            cancelAnimationFrame(raf)
            publish()
        }

        video.addEventListener('play', start)
        video.addEventListener('playing', start)
        video.addEventListener('pause', stop)
        video.addEventListener('ended', stop)
        video.addEventListener('seeked', publish)
        video.addEventListener('timeupdate', publish)
        if (!video.paused) start()

        return (): void => {
            cancelAnimationFrame(raf)
            video.removeEventListener('play', start)
            video.removeEventListener('playing', start)
            video.removeEventListener('pause', stop)
            video.removeEventListener('ended', stop)
            video.removeEventListener('seeked', publish)
            video.removeEventListener('timeupdate', publish)
        }
    }, [video])

    return time
}

/**
 * Derive {@link VideoInfo} (intrinsic width/height + duration) from a video element once its metadata has loaded.
 * Returns `null` until a video with metadata is present.
 */
export const useVideoInfo = (
    video: HTMLVideoElement | null,
): null | VideoInfo => {
    const [info, setInfo] = useState<null | VideoInfo>(null)

    useEffect(() => {
        if (video === null) return

        const update = (): void => {
            if (video.videoWidth > 0 && video.videoHeight > 0)
                setInfo({
                    height: video.videoHeight,
                    length: Number.isFinite(video.duration)
                        ? video.duration
                        : 0,
                    width: video.videoWidth,
                })
        }
        update()

        video.addEventListener('loadedmetadata', update)
        video.addEventListener('durationchange', update)

        return (): void => {
            video.removeEventListener('loadedmetadata', update)
            video.removeEventListener('durationchange', update)
            // Clearing on cleanup (not in the effect body) resets stale geometry when the video changes or unmounts.
            setInfo(null)
        }
    }, [video])

    return info
}
