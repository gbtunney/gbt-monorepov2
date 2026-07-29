import { describe, expect, it } from 'vitest'

import { timeOffsetToSeconds } from './time.ts'

describe('timeOffsetToSeconds', () => {
    it('treats a missing offset as the start of the video', () => {
        expect(timeOffsetToSeconds()).toBe(0)
        expect(timeOffsetToSeconds(null)).toBe(0)
        expect(timeOffsetToSeconds({})).toBe(0)
    })

    it('combines seconds and nanos', () => {
        expect(timeOffsetToSeconds({ nanos: 500_000_000, seconds: 3 })).toBe(
            3.5,
        )
    })

    it('parses a numeric string seconds field (raw REST JSON)', () => {
        expect(timeOffsetToSeconds({ seconds: '12' })).toBe(12)
    })

    it('falls back to zero seconds when the string is not numeric', () => {
        expect(timeOffsetToSeconds({ nanos: 250_000_000, seconds: 'x' })).toBe(
            0.25,
        )
    })
})
