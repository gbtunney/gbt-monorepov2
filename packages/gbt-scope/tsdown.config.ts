import { defineBuildPlan, toTsdownConfigs } from '@snailicid3/build-config'
import { defineConfig } from 'tsdown'
import pkg from './package.json' with { type: 'json' }

const plan = defineBuildPlan(pkg, {
    entries: [
        {
            key: '*',
            output_formats: ['esm', 'cjs', 'ts'],
            runtime: 'universal',
        },
    ],
    root: {
        outputDir: './dist',
        sourceDir: './src',
    },
})

const tsdownConfigs = toTsdownConfigs(plan)

/**
 * Figma shader entry point.
 *
 * Strips TypeScript and emits a single ESM file that the Figma
 * shader runtime can consume directly. `figma:shaders` is kept
 * as an external — the Figma host provides it at runtime.
 */
const figmaShaderConfig = {
    entry: {
        'figma/kaleidoscope': 'src/figma/shader-radial-symmetry.ts',
    },
    outDir: 'dist',
    format: 'esm' as const,
    external: ['figma:shaders'],
    clean: false,
    dts: false,
}

export default defineConfig([...tsdownConfigs, figmaShaderConfig])
