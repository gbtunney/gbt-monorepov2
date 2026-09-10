/**
 * Ambient module declaration for the Figma shader runtime.
 *
 * `figma:shaders` is a virtual module available only inside the
 * Figma custom-shader execution environment. This declaration
 * satisfies the TypeScript resolver so the import compiles.
 */
declare module 'figma:shaders' {
    /** Property definition for a shader parameter. */
    interface ShaderPropertyDefinition {
        type: 'number' | 'boolean' | 'string' | 'color' | 'gradient'
        label?: string
        defaultValue?: unknown
        control?: 'slider' | 'input' | 'select'
        unit?: string
        min?: number
        max?: number
        step?: number
        options?: Array<{ label: string; value: number }>
    }

    /**
     * Registers user-facing property controls for a shader
     * effect or fill.
     */
    export function defineProperties(
        target: () => void,
        properties: Record<string, ShaderPropertyDefinition>,
    ): void
}

/**
 * Runtime frame object passed to shader `setup` and `render`
 * entry points by the Figma shader host.
 */
interface ShaderFrame {
    /** User-configured parameter values keyed by property id. */
    params: Record<string, unknown>
    /** Persistent state that survives across render calls. */
    state: Record<string, unknown>
    /** Input texture (effects only — `null` for fills). */
    input: GPUTexture | null
    /** Output texture to write the final pixels into. */
    output: GPUTexture
}
