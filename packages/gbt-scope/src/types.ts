import { type Dimensions } from './helpers.ts'
import { type GbtScopeAnimator } from './motion/animator.ts'

/**
 * Curve parameters controlling how an input value (eg. pointer distance from center, scroll velocity) maps to an effect
 * amount. Replaces the old `[min, max]` tuple form of `mouse_curve` with a richer, named shape.
 *
 * @see applyCurve in ./motion/curve.ts
 */
export type GbtScopeCurve = {
    /** Lower clamp applied after curving. Default 0. */
    min?: number
    /** Upper clamp applied after curving. Default 1. */
    max?: number
    /** Linear gain applied before the exponent. Default 1. */
    multiplier?: number
    /** Shaping exponent (1 = linear, >1 = ease-in). Default 1. */
    exponent?: number
    /** Input magnitude below this is treated as 0. Default 0. */
    deadzone?: number
    /** Negate the result. Default false. */
    invert?: boolean
}

/**
 * Tiling strategy applied to the kaleidoscope pattern after the radial fold.
 *
 * - `none` — no wrapping; the pattern is sampled directly.
 * - `repeat` — `fract(uv * tiling)` square repeats (the historical behavior).
 * - `mirror` — mirrored repeats for seamless edges.
 */
export type GbtScopeTileMode = 'none' | 'repeat' | 'mirror'

/**
 * Shared, serializable material props for all GbtScope viewers (flat + 3D mesh). camelCase only — animation is
 * data-driven via {@link GbtScopeAnimator}, not speed fields. `rotation`/`offset`/`scaleFactor`/`opacity` are the
 * resting (base) values the animators build on.
 */
export type GbtScopeMaterialProps = {
    src: string
    segments?: number
    opacity?: number
    scaleFactor?: number
    tiling?: number
    tileMode?: GbtScopeTileMode
    imageAspect?: number
    rotation?: number
    /** Multiplier on the rotation uniform (`uRotationAmount`). */
    rotationScale?: number
    offset?: [number, number]
    /** Multiplier on the offset uniform (`uOffsetAmount`). */
    offsetScale?: number
    /** Pre-resolved texture dimensions; viewers derive this from `resolution`. */
    dimensions?: Dimensions
}

/**
 * Canonical default values for {@link GbtScopeMaterialProps}. `src` is required and has no default. Imported by
 * component defaults and Storybook args so the defaults live in a single place.
 */
export const defaultGbtScopeMaterialProps = {
    segments: 6,
    opacity: 1,
    scaleFactor: 1,
    tiling: 1,
    tileMode: 'repeat' as GbtScopeTileMode,
    imageAspect: 1,
    rotation: 0,
    rotationScale: 1,
    offset: [0, 0] as [number, number],
    offsetScale: 1,
} satisfies Omit<GbtScopeMaterialProps, 'src'>

/**
 * Viewer-level props shared by both the flat and mesh viewers. Camera config is viewer-specific and declared on each
 * component. Material props are forwarded down to {@link GbtScopeMaterialProps}.
 */
export type GbtScopeViewerBaseProps = {
    /** Aspect ratio of the host canvas. */
    aspect_ratio?: number | 'parent'
    /** Canvas background; `'screen'` resolution matches the viewport. */
    resolution?: 'screen' | Dimensions | null
    bg_color?: string
    /** Declarative motion rules applied each frame. */
    animators?: GbtScopeAnimator[]
}
