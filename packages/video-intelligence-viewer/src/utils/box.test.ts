import { describe, expect, it } from 'vitest'
import { boxAtTime } from './box.ts'
import { type TimestampedObject } from '../types.ts'

const frames: Array<TimestampedObject> = [
    {
        normalized_bounding_box: { bottom: 0.2, left: 0, right: 0.2, top: 0 },
        time_offset: { seconds: 0 },
    },
    {
        normalized_bounding_box: { bottom: 1, left: 0.8, right: 1, top: 0.8 },
        time_offset: { seconds: 2 },
    },
]

describe('boxAtTime', () => {
    it('returns null with no frames', () => {
        expect(boxAtTime([], 1)).toBeNull()
    })

    it('returns the first frame at the start', () => {
        expect(boxAtTime(frames, 0)).toEqual({
            bottom: 0.2,
            left: 0,
            right: 0.2,
            top: 0,
        })
    })

    it('interpolates halfway between frames', () => {
        const box = boxAtTime(frames, 1)
        expect(box?.left).toBeCloseTo(0.4)
        expect(box?.top).toBeCloseTo(0.4)
        expect(box?.right).toBeCloseTo(0.6)
        expect(box?.bottom).toBeCloseTo(0.6)
    })

    it('returns null outside the segment', () => {
        expect(
            boxAtTime(frames, 5, {
                end_time_offset: { seconds: 2 },
                start_time_offset: { seconds: 0 },
            }),
        ).toBeNull()
    })
})
