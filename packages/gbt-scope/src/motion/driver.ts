import { type Scene, type ShaderMaterial, Vector2 } from '@babylonjs/core'
import {
    applyAnimators,
    type GbtScopeAnimator,
    type GbtScopeState,
} from './animator.ts'
import { type PointerStateHandle } from './pointer.ts'
import { type ScrollStateHandle } from './scroll.ts'

export type GbtScopeDriverOptions = {
    /** Live list of animators (read every frame). */
    animatorsRef: MutableRef<Array<GbtScopeAnimator>>
    pointer: PointerStateHandle
    scroll: ScrollStateHandle
    /**
     * Persistent runtime state. The driver accumulates into it each frame; the owner re-seeds `current` from base props
     * to make changes live.
     */
    stateRef: MutableRef<GbtScopeState>
}

/** Minimal mutable-ref shape (compatible with React's useRef result). */
export type MutableRef<Type> = { current: Type }

/** Pushes a {@link GbtScopeState} onto the shader material's uniforms. */
const writeState = (material: ShaderMaterial, state: GbtScopeState): void => {
    material.setFloat('uRotation', state.rotation)
    material.setFloat('uScaleFactor', state.scaleFactor)
    material.setFloat('uOpacity', state.opacity)
    material.setVector2(
        'uOffset',
        new Vector2(state.offset[0], state.offset[1]),
    )
}

/**
 * Registers a single render-loop observer that drives the material's animated uniforms from the animators + live
 * inputs, frame-rate independent via `engine.getDeltaTime()`. Replaces Babylon's Animation API. Returns a dispose
 * function that removes the observer.
 */
export const createGbtScopeDriver = (
    scene: Scene,
    material: ShaderMaterial,
    { animatorsRef, pointer, scroll, stateRef }: GbtScopeDriverOptions,
): (() => void) => {
    let time = 0

    const observer = scene.onBeforeRenderObservable.add(() => {
        const delta = scene.getEngine().getDeltaTime() / 1000
        time += delta

        const inputs = {
            delta,
            mouseDistance: Math.hypot(pointer.state.x, pointer.state.y),
            scrollProgress: scroll.state.progress,
            scrollVelocity: scroll.state.velocity,
            time,
        }

        stateRef.current = applyAnimators(
            stateRef.current,
            animatorsRef.current,
            inputs,
        )
        writeState(material, stateRef.current)

        // Velocity is impulse-based; bleed it off each frame.
        scroll.decay()
    })

    return (): void => {
        scene.onBeforeRenderObservable.remove(observer)
    }
}
