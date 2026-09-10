# Figma Custom Shaders

This directory contains custom shader effects authored for the
[Figma shader runtime](https://help.figma.com/hc/en-us/articles/...). Each
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

Figma shaders are deployed through **Figma’s own pipeline**, not npm.
The built `dist/figma/kaleidoscope.js` is the artifact you feed into
that pipeline.

### First-time setup

1. Open any Figma design file.
2. Open the **Tools** panel from the navigation bar (top-left toolbar icon).
3. Click **Custom effects** (or **Custom fills** for fill shaders).
4. Click **New effect** → this opens the shader code editor.
5. Replace the boilerplate with the contents of `dist/figma/kaleidoscope.js`.
6. In the code editor sidebar, update the shader **name** and **description**
   to match `features.json`.
7. Click **Save** — the effect is now available across all your files.

### Updating an existing shader

1. Open the **Tools** panel → **Custom effects**.
2. Find **Kaleidoscope** in the list and click the **Edit** (pencil) icon.
3. Replace the code with the updated contents of `dist/figma/kaleidoscope.js`.
4. Click **Save** — all layers using this effect update automatically.

### Applying the effect to a layer

1. Select the target layer(s) on the canvas.
2. Open the **Tools** panel → **Custom effects**.
3. Click **Kaleidoscope** — it attaches to the selected layer(s).
4. Adjust parameters (Segments, Scale, Tiling, etc.) in the
   right-hand properties panel.

## Toggling parameters

In `shader-radial-symmetry.ts`, each parameter is defined as a named
`PROP_*` const. The `defineProperties` block at the bottom of the file
registers which parameters appear in the Figma UI:

```ts
/* eslint-disable sort/object-properties */
defineProperties(Effect, {
    segments: PROP_SEGMENTS,
    scaleFactor: PROP_SCALE_FACTOR,
    // tiling: PROP_TILING,          ← commented out = hardcoded to default
    tileMode: PROP_TILE_MODE,
    ...
})
/* eslint-enable sort/object-properties */
```

- **Comment out** a line to hide that control and hardcode its default.
- **Reorder** lines to change the order controls appear in the UI.
- The `render` function falls back to defaults for missing params,
  so no other changes are needed.

## Adding a new shader

1. Create a new `.ts` file in this directory (e.g. `shader-glass-refraction.ts`).
2. Follow the same structure: `Effect` default export, `setup`, `render`,
   and `defineProperties`.
3. Add a new entry in `tsdown.config.ts`:
   ```ts
   const figmaShaderConfig = {
       entry: {
           'figma/kaleidoscope': 'src/figma/shader-radial-symmetry.ts',
           'figma/glass-refraction': 'src/figma/shader-glass-refraction.ts',
       },
       // ...
   }
   ```
4. Add a matching export in `package.json`:
   ```json
   "./figma/glass-refraction": {
       "import": "./dist/figma/glass-refraction.js"
   }
   ```
5. Build, then follow the **First-time setup** steps above to publish.
