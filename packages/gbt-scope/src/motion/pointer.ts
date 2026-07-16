/** Current normalized pointer position, centered on the canvas, range [-1, 1]. */
export type PointerState = {
    readonly x: number
    readonly y: number
}

export type PointerStateHandle = {
    /** Live pointer position. Mutated internally; read it inside a render loop. */
    state: PointerState
    /** Attach mousemove/mouseleave listeners to a canvas. */
    attach: (canvas: HTMLCanvasElement) => void
    /** Remove the listeners. Call from the scene's onDisposeObservable. */
    detach: (canvas: HTMLCanvasElement) => void
}

/**
 * Creates a mutable pointer-state object for use inside a Babylon.js scene setup callback. Intentionally NOT a React
 * hook: `onSceneReady` runs outside React's render cycle, so a hook's state would be stale inside the render
 * observable. The returned `state` object is mutated in place and is safe to read every frame.
 *
 * Position is normalized to [-1, 1] on both axes (canvas-relative) and resets to [0, 0] when the pointer leaves the
 * canvas.
 */
export const createPointerState = (): PointerStateHandle => {
    const _state = { x: 0, y: 0 }

    const handleMouseMove = (event: MouseEvent): void => {
        const canvas = event.currentTarget as HTMLCanvasElement
        const rect = canvas.getBoundingClientRect()
        _state.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
        _state.y = ((event.clientY - rect.top) / rect.height) * 2 - 1
    }

    const handleMouseLeave = (): void => {
        _state.x = 0
        _state.y = 0
    }

    return {
        state: _state,
        attach: (canvas: HTMLCanvasElement): void => {
            canvas.addEventListener('mousemove', handleMouseMove)
            canvas.addEventListener('mouseleave', handleMouseLeave)
        },
        detach: (canvas: HTMLCanvasElement): void => {
            canvas.removeEventListener('mousemove', handleMouseMove)
            canvas.removeEventListener('mouseleave', handleMouseLeave)
        },
    }
}
