import { type GbtScopeCurve } from '../types.ts'

/**
 * Maps an input value through a {@link GbtScopeCurve}: deadzone → gain → exponent → clamp → optional invert. The input
 * is treated by magnitude (`Math.abs`), so direction is supplied by `invert`, not the sign of `value`.
 */
export const applyCurve = (
    value: number,
    curve: GbtScopeCurve = {},
): number => {
    const {
        deadzone = 0,
        exponent = 1,
        invert = false,
        max = 1,
        min = 0,
        multiplier = 1,
    } = curve
    const normalized = Math.max(0, Math.abs(value) - deadzone)
    const curved = Math.pow(normalized * multiplier, exponent)
    const clamped = Math.min(Math.max(curved, min), max)
    return invert ? -clamped : clamped
}

/**
 * Type guard distinguishing the legacy `[min, max]` tuple form of `mouse_curve` from the richer {@link GbtScopeCurve}
 * object form.
 */
export const isTupleCurve = (
    value: [number, number] | GbtScopeCurve,
): value is [number, number] => {
    if (!Array.isArray(value)) return false
    // Widen so the runtime length/type checks aren't "always true" for the tuple type.
    const items: ReadonlyArray<unknown> = value
    return (
        items.length === 2 &&
        typeof items[0] === 'number' &&
        typeof items[1] === 'number'
    )
}

/**
 * Bridges the legacy `[min, max]` tuple (plus a separate `mouse_multiplier`) into an equivalent {@link GbtScopeCurve}.
 * With the historical defaults `[0, 0.015]` and multiplier `0.01`, `applyCurve` reproduces the old inline
 * `Math.min(Math.max(dist * mult, min), max)` clamp exactly.
 */
export const tupleToGbtScopeCurve = (
    tuple: [number, number],
    multiplier = 1,
): GbtScopeCurve => ({
    max: tuple[1],
    min: tuple[0],
    multiplier,
})
