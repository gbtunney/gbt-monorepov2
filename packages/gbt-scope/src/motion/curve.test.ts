import { describe, expect, it } from 'vitest'
import { applyCurve, isTupleCurve, tupleToGbtScopeCurve } from './curve.ts'

describe('applyCurve', () => {
    it('passes a value through unchanged with default curve (clamped to [0, 1])', () => {
        expect(applyCurve(0.5)).toBe(0.5)
        expect(applyCurve(0)).toBe(0)
        expect(applyCurve(1)).toBe(1)
    })

    it('clamps to the default max of 1', () => {
        expect(applyCurve(2)).toBe(1)
    })

    it('treats the input by magnitude (negative values behave like positive)', () => {
        expect(applyCurve(-0.5)).toBe(0.5)
        expect(applyCurve(-2)).toBe(1)
    })

    it('subtracts the deadzone before shaping', () => {
        expect(applyCurve(0.3, { deadzone: 0.1 })).toBeCloseTo(0.2)
        expect(applyCurve(0.05, { deadzone: 0.1 })).toBe(0)
    })

    it('applies the multiplier as linear gain', () => {
        expect(applyCurve(0.2, { multiplier: 2 })).toBeCloseTo(0.4)
    })

    it('applies the exponent after the gain', () => {
        expect(applyCurve(0.5, { exponent: 2 })).toBeCloseTo(0.25)
        expect(applyCurve(0.25, { exponent: 0.5 })).toBeCloseTo(0.5)
    })

    it('clamps to min and max after curving', () => {
        expect(applyCurve(0, { min: 0.1 })).toBe(0.1)
        expect(applyCurve(0.8, { max: 0.5 })).toBe(0.5)
    })

    it('negates the result when invert is set', () => {
        expect(applyCurve(0.5, { invert: true })).toBe(-0.5)
    })

    it('applies stages in order: deadzone -> gain -> exponent -> clamp', () => {
        // (|0.6| - 0.1) * 2 = 1, 1^2 = 1, clamped to max 0.9
        expect(
            applyCurve(0.6, {
                deadzone: 0.1,
                exponent: 2,
                max: 0.9,
                multiplier: 2,
            }),
        ).toBeCloseTo(0.9)
    })
})

describe('isTupleCurve', () => {
    it('accepts a [number, number] tuple', () => {
        expect(isTupleCurve([0, 0.015])).toBe(true)
    })

    it('rejects a curve object', () => {
        expect(isTupleCurve({ max: 1, min: 0 })).toBe(false)
    })
})

describe('tupleToGbtScopeCurve', () => {
    it('maps [min, max] and the multiplier onto the curve shape', () => {
        expect(tupleToGbtScopeCurve([0, 0.015], 0.01)).toEqual({
            max: 0.015,
            min: 0,
            multiplier: 0.01,
        })
    })

    it('reproduces the legacy inline clamp exactly', () => {
        /** Legacy: Math.min(Math.max(dist * mult, min), max) */
        const legacy = (dist: number, mult: number, min: number, max: number) =>
            Math.min(Math.max(dist * mult, min), max)
        const curve = tupleToGbtScopeCurve([0, 0.015], 0.01)
        for (const dist of [0, 0.3, 1, 1.4, 5]) {
            expect(applyCurve(dist, curve)).toBeCloseTo(
                legacy(dist, 0.01, 0, 0.015),
            )
        }
    })
})
