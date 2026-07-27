import { describe, expect, it } from 'vitest'
import { poseAtTime } from './person.ts'
import { type PersonTrack } from '../types.ts'

const track: PersonTrack = {
    confidence: 0.9,
    segment: {
        end_time_offset: { seconds: 2 },
        start_time_offset: { seconds: 0 },
    },
    timestamped_objects: [
        {
            landmarks: [{ name: 'nose', point: { x: 0, y: 0 } }],
            normalized_bounding_box: {
                bottom: 0.2,
                left: 0,
                right: 0.2,
                top: 0,
            },
            time_offset: { seconds: 0 },
        },
        {
            landmarks: [{ name: 'nose', point: { x: 1, y: 1 } }],
            normalized_bounding_box: {
                bottom: 1,
                left: 0.8,
                right: 1,
                top: 0.8,
            },
            time_offset: { seconds: 2 },
        },
    ],
}

describe('poseAtTime', () => {
    it('returns null outside the track segment', () => {
        expect(poseAtTime(track, 5)).toBeNull()
        expect(poseAtTime(track, -1)).toBeNull()
    })

    it('returns null when there are no sampled frames', () => {
        expect(poseAtTime({ timestamped_objects: [] }, 0)).toBeNull()
    })

    it('returns the first frame at the start', () => {
        expect(poseAtTime(track, 0)?.box).toEqual({
            bottom: 0.2,
            left: 0,
            right: 0.2,
            top: 0,
        })
    })

    it('interpolates the box halfway between frames', () => {
        const pose = poseAtTime(track, 1)
        expect(pose?.box.bottom).toBeCloseTo(0.6)
        expect(pose?.box.left).toBeCloseTo(0.4)
        expect(pose?.box.right).toBeCloseTo(0.6)
        expect(pose?.box.top).toBeCloseTo(0.4)
    })

    it('interpolates landmarks by index', () => {
        const pose = poseAtTime(track, 1)
        expect(pose?.landmarks[0]).toEqual({ name: 'nose', x: 0.5, y: 0.5 })
    })
})
