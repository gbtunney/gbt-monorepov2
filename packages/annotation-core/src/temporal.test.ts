import { describe, expect, it } from 'vitest'

import {
    containsPoint,
    overlapsInterval,
    rebaseFromSegment,
    rebaseToSegment,
    shiftTemporal,
    temporalDuration,
    temporalEnd,
    temporalStart,
} from './temporal.ts'
import { type MediaSegment, type TemporalTarget } from './types.ts'

const whole: TemporalTarget = { kind: 'whole' }
const point: TemporalTarget = { at: 5, kind: 'point' }
const interval: TemporalTarget = { end: 20, kind: 'interval', start: 10 }

describe('temporalStart / temporalEnd / temporalDuration', () => {
    it('treats a whole-file target as starting at zero', () => {
        expect(temporalStart(whole)).toBe(0)
    })

    it('leaves a whole-file target open-ended without a media duration', () => {
        expect(temporalEnd(whole)).toBe(Infinity)
        expect(temporalDuration(whole)).toBe(Infinity)
    })

    it('closes a whole-file target once the media duration is known', () => {
        expect(temporalEnd(whole, 42)).toBe(42)
        expect(temporalDuration(whole, 42)).toBe(42)
    })

    it('gives a point zero length', () => {
        expect(temporalStart(point)).toBe(5)
        expect(temporalEnd(point)).toBe(5)
        expect(temporalDuration(point)).toBe(0)
    })

    it('measures an interval', () => {
        expect(temporalDuration(interval)).toBe(10)
    })
})

describe('containsPoint', () => {
    it('matches anything against a whole-file target', () => {
        expect(containsPoint(whole, 999)).toBe(true)
    })

    it('matches a point within tolerance but not outside it', () => {
        expect(containsPoint(point, 5.02)).toBe(true)
        expect(containsPoint(point, 6)).toBe(false)
    })

    it('honours an explicit tolerance', () => {
        expect(containsPoint(point, 6, 2)).toBe(true)
    })

    it('treats intervals as half-open so adjacent shots do not both claim the boundary', () => {
        const shotA: TemporalTarget = { end: 10, kind: 'interval', start: 0 }
        const shotB: TemporalTarget = { end: 20, kind: 'interval', start: 10 }

        expect(containsPoint(shotA, 10)).toBe(false)
        expect(containsPoint(shotB, 10)).toBe(true)
    })
})

describe('overlapsInterval', () => {
    it('counts partial overlap as in range', () => {
        expect(overlapsInterval(interval, 15, 30)).toBe(true)
        expect(overlapsInterval(interval, 0, 15)).toBe(true)
    })

    it('excludes disjoint ranges', () => {
        expect(overlapsInterval(interval, 30, 40)).toBe(false)
    })

    it('includes points falling inside the range', () => {
        expect(overlapsInterval(point, 0, 10)).toBe(true)
        expect(overlapsInterval(point, 6, 10)).toBe(false)
    })

    it('always includes whole-file targets', () => {
        expect(overlapsInterval(whole, 100, 200)).toBe(true)
    })
})

describe('shiftTemporal', () => {
    it('shifts points and intervals', () => {
        expect(shiftTemporal(point, 3)).toStrictEqual({ at: 8, kind: 'point' })
        expect(shiftTemporal(interval, -5)).toStrictEqual({
            end: 15,
            kind: 'interval',
            start: 5,
        })
    })

    it('clamps at zero rather than producing negative timecodes', () => {
        expect(shiftTemporal(point, -100)).toStrictEqual({
            at: 0,
            kind: 'point',
        })
    })

    it('leaves whole-file targets alone', () => {
        expect(shiftTemporal(whole, 50)).toStrictEqual(whole)
    })
})

describe('rebaseToSegment / rebaseFromSegment', () => {
    const segment: MediaSegment = {
        end: 130,
        id: 'seg-1',
        label: 'Chapter 3',
        mediaId: 'media-1',
        start: 100,
    }

    it('converts a source-timeline target into clip-relative time', () => {
        const source: TemporalTarget = {
            end: 125,
            kind: 'interval',
            start: 110,
        }

        expect(rebaseToSegment(source, segment)).toStrictEqual({
            end: 25,
            kind: 'interval',
            start: 10,
        })
    })

    it('round-trips back onto the source timeline', () => {
        const source: TemporalTarget = {
            end: 125,
            kind: 'interval',
            start: 110,
        }
        const roundTripped = rebaseFromSegment(
            rebaseToSegment(source, segment),
            segment,
        )

        expect(roundTripped).toStrictEqual(source)
    })
})
