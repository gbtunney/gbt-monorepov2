import { describe, expect, it } from 'vitest'
import { lerp, timeOffsetToSeconds } from './time.ts'

describe('timeOffsetToSeconds', () => {
    it('treats a missing offset as 0', () => {
        expect(timeOffsetToSeconds()).toBe(0)
        expect(timeOffsetToSeconds(null)).toBe(0)
        expect(timeOffsetToSeconds({})).toBe(0)
    })

    it('combines seconds and nanos', () => {
        expect(timeOffsetToSeconds({ nanos: 500_000_000, seconds: 3 })).toBe(
            3.5,
        )
    })

    it('parses a numeric string for seconds', () => {
        expect(timeOffsetToSeconds({ seconds: '12' })).toBe(12)
    })

    it('handles nanos-only offsets', () => {
        expect(timeOffsetToSeconds({ nanos: 250_000_000 })).toBe(0.25)
    })
})

describe('lerp', () => {
    it('interpolates linearly', () => {
        expect(lerp(0, 10, 0.5)).toBe(5)
        expect(lerp(2, 4, 0.25)).toBe(2.5)
    })

    it('clamps the ratio to 0–1', () => {
        expect(lerp(0, 10, -1)).toBe(0)
        expect(lerp(0, 10, 2)).toBe(10)
    })
})
