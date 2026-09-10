# Figma Custom Shaders

This directory contains custom shader effects authored for the
[Figma shader runtime](https://help.figma.com/hc/en-us/articles/41147702210071-Create-shaders-with-the-Figma-agent). Each
shader is maintained as typed TypeScript source and built into
Figma-compatible ESM via `tsdown`.

## Directory layout

```
src/figma/
├── figma-shaders.d.ts            # ambient types for figma:shaders module
├── features.json                 # Figma shader manifest (name, version, flags)
├── shader-radial-symmetry.ts     # Kaleidoscope effect source
└── README.md                     # this file
```

## Building

The `tsdown.config.ts` at the package root includes a dedicated entry
for the Figma shader:

```bash
pnpm build        # builds everything, including dist/figma/kaleidoscope.js
```

The output lands at `dist/figma/kaleidoscope.js` — a clean ESM file with
`figma:shaders` left as an external import (the Figma host provides it
at runtime).

## Publishing to Figma

Figma shaders are created and managed in Figma. The built
`dist/figma/kaleidoscope.js` keeps the repository implementation available
as a reusable artifact and reference implementation.

For the current shader workflow, see Figma's
[Create shaders with the Figma agent](https://help.figma.com/hc/en-us/articles/41147702210071-Create-shaders-with-the-Figma-agent)
and
[Find and use shaders](https://help.figma.com/hc/en-us/articles/41175721167767-Find-and-use-shaders)
documentation.

## Toggling parameters

In `shader-radial-symmetry.ts`, each parameter is defined as a named
`PROP_*` const. The `defineProperties` block at the bottom of the file
registers which parameters appear in the Figma UI.

- Remove a property from `defineProperties` to hide that control while retaining its runtime fallback.
- Reorder properties to control their intended presentation order where supported by the host.
- Keep the corresponding render fallback when a property is not exposed.

## Adding a new shader

1. Create a new `.ts` file in this directory, such as `shader-glass-refraction.ts`.
2. Follow the same structure: `Effect` default export, `setup`, `render`, and `defineProperties`.
3. Add a matching entry to the Figma shader build config in `tsdown.config.ts`.
4. Add a matching package export when the built shader should be consumable from the package.
5. Build from the repository root using the package's standard pnpm/Nx commands.
