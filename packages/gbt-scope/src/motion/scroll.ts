/** Current scroll signals. `progress` is [0,1]; `velocity` decays toward 0. */
export type ScrollState = {
    readonly progress: number
    readonly velocity: number
}

export type ScrollStateHandle = {
    /** Live scroll signals. Mutated internally; read inside a render loop. */
    state: ScrollState
    /** Attach scroll/wheel listeners (defaults to window). */
    attach: (target?: HTMLElement | Window) => void
    /** Remove listeners. Call from the scene's onDisposeObservable. */
    detach: (target?: HTMLElement | Window) => void
    /**
     * Decay the velocity by one frame's worth (call once per frame from the driver after reading). `factor` in [0,1];
     * lower = faster decay.
     */
    decay: (factor?: number) => void
}

const readProgress = (): number => {
    if (typeof window === 'undefined' || typeof document === 'undefined')
        return 0
    const doc = document.documentElement
    const max = doc.scrollHeight - doc.clientHeight
    return max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0
}

/**
 * Creates a mutable scroll-state object for use inside a Babylon.js scene setup callback. Tracks page scroll `progress`
 * [0,1] and a wheel-driven `velocity` that the driver decays each frame. Plain factory (not a React hook) — mirrors
 * {@link createPointerState} so it can be read from the render observable.
 */
export const createScrollState = (): ScrollStateHandle => {
    const _state = { progress: readProgress(), velocity: 0 }

    const handleWheel = (event: WheelEvent): void => {
        // Normalize wheel delta to a small per-event velocity contribution.
        _state.velocity += event.deltaY / 1000
    }

    const handleScroll = (): void => {
        _state.progress = readProgress()
    }

    const resolve = (target?: HTMLElement | Window): HTMLElement | Window =>
        target ?? (typeof window !== 'undefined' ? window : ({} as Window))

    return {
        state: _state,
        attach: (target?: HTMLElement | Window): void => {
            const t = resolve(target)
            t.addEventListener('wheel', handleWheel as EventListener, {
                passive: true,
            })
            t.addEventListener('scroll', handleScroll as EventListener, {
                passive: true,
            })
        },
        detach: (target?: HTMLElement | Window): void => {
            const t = resolve(target)
            t.removeEventListener('wheel', handleWheel as EventListener)
            t.removeEventListener('scroll', handleScroll as EventListener)
        },
        decay: (factor = 0.9): void => {
            _state.velocity *= factor
            if (Math.abs(_state.velocity) < 1e-4) _state.velocity = 0
        },
    }
}
