/** Current normalized pointer position, centered on the canvas, range [-1, 1]. */
export type PointerState = {
    readonly x: number
    readonly y: number
}

export type PointerStateHandle = {
    /** Attach pointerdown/pointermove/pointerleave listeners to a canvas. */
    attach: (canvas: HTMLCanvasElement) => void
    /** Remove the listeners. Call from the scene's onDisposeObservable. */
    detach: (canvas: HTMLCanvasElement) => void
    /** Live pointer position. Mutated internally; read it inside a render loop. */
    state: PointerState
}

/**
 * Creates a mutable pointer-state object for use inside a Babylon.js scene setup callback. Intentionally NOT a React
 * hook: `onSceneReady` runs outside React's render cycle, so a hook's state would be stale inside the render
 * observable. The returned `state` object is mutated in place and is safe to read every frame.
 *
 * Position is normalized to [-1, 1] on both axes (canvas-relative). Uses pointer events so mouse and touch behave
 * uniformly: a mouse resets to [0, 0] on leaving the canvas, while a touch latches at the last tap/drag position
 * (tap center to zero it) — hover-less devices would otherwise never produce input.
 */
export const createPointerState = (): PointerStateHandle => {
    const _state = { x: 0, y: 0 }

    const handlePointerMove = (event: PointerEvent): void => {
        const canvas = event.currentTarget as HTMLCanvasElement
        const rect = canvas.getBoundingClientRect()
        _state.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
        _state.y = ((event.clientY - rect.top) / rect.height) * 2 - 1
    }

    const handlePointerLeave = (event: PointerEvent): void => {
        // Touch pointers "leave" on every finger lift; keep their latch and only reset for mouse hover-out.
        if (event.pointerType !== 'mouse') return
        _state.x = 0
        _state.y = 0
    }

    return {
        attach: (canvas: HTMLCanvasElement): void => {
            canvas.addEventListener('pointerdown', handlePointerMove)
            canvas.addEventListener('pointermove', handlePointerMove)
            canvas.addEventListener('pointerleave', handlePointerLeave)
        },
        detach: (canvas: HTMLCanvasElement): void => {
            canvas.removeEventListener('pointerdown', handlePointerMove)
            canvas.removeEventListener('pointermove', handlePointerMove)
            canvas.removeEventListener('pointerleave', handlePointerLeave)
        },
        state: _state,
    }
}
