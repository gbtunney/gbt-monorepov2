import { applyCurve } from './curve.ts'
import { type GbtScopeCurve } from '../types.ts'

/** Uniform-backed value an animator can drive. */
export type GbtScopeAnimatorTarget =
    'rotation' | 'offset.x' | 'offset.y' | 'scaleFactor' | 'opacity'

/** Input signal an animator reads from. */
export type GbtScopeAnimatorSource =
    'time' | 'mouseDistance' | 'scrollProgress' | 'scrollVelocity'

/**
 * A single declarative animation rule: read `source`, shape it through `curve`, scale by `speed * delta`, then `add` to
 * (default) or `set` the `target`.
 */
export type GbtScopeAnimator = {
    target: GbtScopeAnimatorTarget
    source: GbtScopeAnimatorSource
    mode?: 'set' | 'add'
    speed?: number
    curve?: GbtScopeCurve
}

/** Mutable, uniform-facing animation state. */
export type GbtScopeState = {
    rotation: number
    offset: [number, number]
    scaleFactor: number
    opacity: number
}

/** Per-frame inputs fed to the animators. */
export type GbtScopeInputs = {
    delta: number
    time: number
    mouseDistance: number
    scrollProgress: number
    scrollVelocity: number
}

/**
 * Applies every animator to a copy of `state` for one frame and returns the new state. Each animator's source value is
 * curved, scaled by `speed * delta` (frame-rate independent), then added to or set on its target.
 */
export const applyAnimators = (
    state: GbtScopeState,
    animators: GbtScopeAnimator[],
    inputs: GbtScopeInputs,
): GbtScopeState => {
    const next: GbtScopeState = { ...state, offset: [...state.offset] }

    const getSourceValue = (source: GbtScopeAnimatorSource): number => {
        switch (source) {
            case 'time':
                return inputs.time
            case 'mouseDistance':
                return inputs.mouseDistance
            case 'scrollProgress':
                return inputs.scrollProgress
            case 'scrollVelocity':
                return inputs.scrollVelocity
        }
    }

    animators.forEach((anim) => {
        const raw = getSourceValue(anim.source)
        const curved = applyCurve(raw, anim.curve)
        const value = (anim.speed ?? 1) * curved * inputs.delta
        const apply = (current: number): number =>
            anim.mode === 'set' ? value : current + value
        switch (anim.target) {
            case 'rotation':
                next.rotation = apply(next.rotation)
                break
            case 'offset.x':
                next.offset = [apply(next.offset[0]), next.offset[1]]
                break
            case 'offset.y':
                next.offset = [next.offset[0], apply(next.offset[1])]
                break
            case 'scaleFactor':
                next.scaleFactor = apply(next.scaleFactor)
                break
            case 'opacity':
                next.opacity = apply(next.opacity)
                break
        }
    })

    return next
}
