import { applyCurve } from './curve.ts'
import { type GbtScopeCurve } from '../types.ts'

/**
 * A single declarative animation rule: read `source`, shape it through `curve`, scale by `speed * delta`, then `add` to
 * (default) or `set` the `target`.
 */
export type GbtScopeAnimator = {
    curve?: GbtScopeCurve
    mode?: 'add' | 'set'
    source: GbtScopeAnimatorSource
    speed?: number
    target: GbtScopeAnimatorTarget
}

/** Input signal an animator reads from. */
export type GbtScopeAnimatorSource =
    'mouseDistance' | 'scrollProgress' | 'scrollVelocity' | 'time'

/** Uniform-backed value an animator can drive. */
export type GbtScopeAnimatorTarget =
    'offset.x' | 'offset.y' | 'opacity' | 'rotation' | 'scaleFactor'

/** Per-frame inputs fed to the animators. */
export type GbtScopeInputs = {
    delta: number
    mouseDistance: number
    scrollProgress: number
    scrollVelocity: number
    time: number
}

/** Mutable, uniform-facing animation state. */
export type GbtScopeState = {
    offset: [number, number]
    opacity: number
    rotation: number
    scaleFactor: number
}

/**
 * Applies every animator to a copy of `state` for one frame and returns the new state. Each animator's source value is
 * curved, scaled by `speed * delta` (frame-rate independent), then added to or set on its target.
 */
export const applyAnimators = (
    state: GbtScopeState,
    animators: Array<GbtScopeAnimator>,
    inputs: GbtScopeInputs,
): GbtScopeState => {
    const next: GbtScopeState = { ...state, offset: [...state.offset] }

    const getSourceValue = (source: GbtScopeAnimatorSource): number => {
        switch (source) {
            case 'mouseDistance':
                return inputs.mouseDistance
            case 'scrollProgress':
                return inputs.scrollProgress
            case 'scrollVelocity':
                return inputs.scrollVelocity
            case 'time':
                return inputs.time
        }
    }

    animators.forEach((anim) => {
        const raw = getSourceValue(anim.source)
        const curved = applyCurve(raw, anim.curve)
        const value = (anim.speed ?? 1) * curved * inputs.delta
        const apply = (current: number): number =>
            anim.mode === 'set' ? value : current + value
        switch (anim.target) {
            case 'offset.x':
                next.offset = [apply(next.offset[0]), next.offset[1]]
                break
            case 'offset.y':
                next.offset = [next.offset[0], apply(next.offset[1])]
                break
            case 'opacity':
                next.opacity = apply(next.opacity)
                break
            case 'rotation':
                next.rotation = apply(next.rotation)
                break
            case 'scaleFactor':
                next.scaleFactor = apply(next.scaleFactor)
                break
        }
    })

    return next
}
