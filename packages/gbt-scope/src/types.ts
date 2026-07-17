import { type Dimensions } from './helpers.ts'
import {
    type GbtScopeAnimator,
    type GbtScopeInputOverrides,
} from './motion/animator.ts'

/**
 * Curve parameters controlling how an input value (eg. pointer distance from center, scroll velocity) maps to an effect
 * amount. Replaces the old `[min, max]` tuple form of `mouse_curve` with a richer, named shape.
 *
 * @see applyCurve in ./motion/curve.ts
 */
export type GbtScopeCurve = {
    /** Input magnitude below this is treated as 0. Default 0. */
    deadzone?: number
    /** Shaping exponent (1 = linear, >1 = ease-in). Default 1. */
    exponent?: number
    /** Negate the result. Default false. */
    invert?: boolean
    /** Upper clamp applied after curving. Default 1. */
    max?: number
    /** Lower clamp applied after curving. Default 0. */
    min?: number
    /** Linear gain applied before the exponent. Default 1. */
    multiplier?: number
}

/**
 * Shared, serializable material props for all GbtScope viewers (flat + 3D mesh). camelCase only — animation is
 * data-driven via {@link GbtScopeAnimator}, not speed fields. `rotation`/`offset`/`scaleFactor`/`opacity` are the
 * resting (base) values the animators build on.
 */
export type GbtScopeMaterialProps = {
    /** Pre-resolved texture dimensions; viewers derive this from `resolution`. */
    dimensions?: Dimensions
    imageAspect?: number
    offset?: [number, number]
    /** Multiplier on the offset uniform (`uOffsetAmount`). */
    offsetScale?: number
    opacity?: number
    rotation?: number
    /** Multiplier on the rotation uniform (`uRotationAmount`). */
    rotationScale?: number
    scaleFactor?: number
    segments?: number
    src: string
    tileMode?: GbtScopeTileMode
    tiling?: number
}

/**
 * Tiling strategy applied to the kaleidoscope pattern after the radial fold.
 *
 * - `none` — no wrapping; the pattern is sampled directly.
 * - `repeat` — `fract(uv * tiling)` square repeats (the historical behavior).
 * - `mirror` — mirrored repeats for seamless edges.
 */
export type GbtScopeTileMode = 'mirror' | 'none' | 'repeat'

/**
 * Canonical default values for {@link GbtScopeMaterialProps}. `src` is required and has no default. Imported by
 * component defaults and Storybook args so the defaults live in a single place.
 */
export const defaultGbtScopeMaterialProps = {
    imageAspect: 1,
    offset: [0, 0] as [number, number],
    offsetScale: 1,
    opacity: 1,
    rotation: 0,
    rotationScale: 1,
    scaleFactor: 1,
    segments: 6,
    tileMode: 'repeat' as GbtScopeTileMode,
    tiling: 1,
} satisfies Omit<GbtScopeMaterialProps, 'src'>

/**
 * Viewer-level props shared by both the flat and mesh viewers. Camera config is viewer-specific and declared on each
 * component. Material props are forwarded down to {@link GbtScopeMaterialProps}.
 */
export type GbtScopeViewerBaseProps = {
    /** Declarative motion rules applied each frame. */
    animators?: Array<GbtScopeAnimator>
    /** Aspect ratio of the host canvas. */
    aspect_ratio?: 'parent' | number
    bg_color?: string
    /** Fixed values replacing the live pointer/scroll inputs (mock/testing). */
    inputOverrides?: GbtScopeInputOverrides
    /** Canvas background; `'screen'` resolution matches the viewport. */
    resolution?: 'screen' | Dimensions | null
}
