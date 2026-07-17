import { describe, expect, it } from 'vitest'
import {
    applyAnimators,
    type GbtScopeInputs,
    type GbtScopeState,
} from './animator.ts'

const baseState = (): GbtScopeState => ({
    offset: [0, 0],
    opacity: 1,
    rotation: 0,
    scaleFactor: 1,
})

const baseInputs = (
    overrides: Partial<GbtScopeInputs> = {},
): GbtScopeInputs => ({
    delta: 0.5,
    mouseDistance: 0.5,
    scrollProgress: 0.25,
    scrollVelocity: 0.8,
    time: 10,
    ...overrides,
})

describe('applyAnimators', () => {
    it('returns an untouched copy when there are no animators', () => {
        const state = baseState()
        const next = applyAnimators(state, [], baseInputs())
        expect(next).toEqual(state)
        expect(next).not.toBe(state)
        expect(next.offset).not.toBe(state.offset)
    })

    it('does not mutate the input state', () => {
        const state = baseState()
        applyAnimators(
            state,
            [{ source: 'time', speed: 2, target: 'rotation' }],
            baseInputs(),
        )
        expect(state.rotation).toBe(0)
        expect(state.offset).toEqual([0, 0])
    })

    it('adds speed * curved(source) * delta to the target (default add mode)', () => {
        // Default curve clamps the raw time (10) to 1 -> 2 * 1 * 0.5 = 1
        const next = applyAnimators(
            baseState(),
            [{ source: 'time', speed: 2, target: 'rotation' }],
            baseInputs(),
        )
        expect(next.rotation).toBeCloseTo(1)
    })

    it('scales by delta, making motion frame-rate independent', () => {
        const animators = [
            { source: 'time', speed: 2, target: 'rotation' } as const,
        ]
        const oneBigFrame = applyAnimators(
            baseState(),
            [...animators],
            baseInputs({ delta: 0.5 }),
        )
        let manySmallFrames = baseState()
        for (let index = 0; index < 5; index++)
            manySmallFrames = applyAnimators(
                manySmallFrames,
                [...animators],
                baseInputs({ delta: 0.1 }),
            )
        expect(manySmallFrames.rotation).toBeCloseTo(oneBigFrame.rotation)
    })

    it('replaces the target value in set mode (still delta-scaled)', () => {
        const state = { ...baseState(), rotation: 42 }
        const next = applyAnimators(
            state,
            [{ mode: 'set', source: 'time', speed: 2, target: 'rotation' }],
            baseInputs(),
        )
        expect(next.rotation).toBeCloseTo(1)
    })

    it('reads each source from the matching input', () => {
        const inputs = baseInputs()
        // Uncapped linear curve so the raw source value passes through.
        const curve = { max: Number.POSITIVE_INFINITY }
        const bySource = (
            source: 'mouseDistance' | 'scrollProgress' | 'scrollVelocity',
        ): number =>
            applyAnimators(
                baseState(),
                [{ curve, source, speed: 1, target: 'rotation' }],
                inputs,
            ).rotation
        expect(bySource('mouseDistance')).toBeCloseTo(
            inputs.mouseDistance * inputs.delta,
        )
        expect(bySource('scrollProgress')).toBeCloseTo(
            inputs.scrollProgress * inputs.delta,
        )
        expect(bySource('scrollVelocity')).toBeCloseTo(
            inputs.scrollVelocity * inputs.delta,
        )
    })

    it('drives offset axes independently', () => {
        const next = applyAnimators(
            baseState(),
            [
                { source: 'time', speed: 2, target: 'offset.x' },
                { source: 'time', speed: 4, target: 'offset.y' },
            ],
            baseInputs(),
        )
        expect(next.offset[0]).toBeCloseTo(1)
        expect(next.offset[1]).toBeCloseTo(2)
    })

    it('drives scaleFactor and opacity', () => {
        const next = applyAnimators(
            baseState(),
            [
                { source: 'time', speed: 2, target: 'scaleFactor' },
                { source: 'time', speed: -1, target: 'opacity' },
            ],
            baseInputs(),
        )
        expect(next.scaleFactor).toBeCloseTo(2)
        expect(next.opacity).toBeCloseTo(0.5)
    })

    it('stacks multiple animators on the same target', () => {
        const next = applyAnimators(
            baseState(),
            [
                { source: 'time', speed: 2, target: 'rotation' },
                { source: 'time', speed: 4, target: 'rotation' },
            ],
            baseInputs(),
        )
        expect(next.rotation).toBeCloseTo(3)
    })

    it('shapes the source through the animator curve', () => {
        // MouseDistance 0.5 -> (0.5 * 0.6)^1 = 0.3, speed 2, delta 0.5 -> 0.3
        const next = applyAnimators(
            baseState(),
            [
                {
                    curve: { multiplier: 0.6 },
                    source: 'mouseDistance',
                    speed: 2,
                    target: 'rotation',
                },
            ],
            baseInputs(),
        )
        expect(next.rotation).toBeCloseTo(0.3)
    })
})
