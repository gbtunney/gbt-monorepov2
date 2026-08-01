# Wallpaper Groups: Scaffold and Future Structure

## Purpose

Add bitmap-driven wallpaper-group rendering to `@snailicid3/gbt-scope` without folding it into the existing radial-kaleidoscope material. The two systems can share viewer conventions and future export tooling while keeping their UV math independently testable.

The first scaffold establishes:

- one public wallpaper-group viewer;
- one dedicated Babylon shader material;
- one registry covering all 17 crystallographic wallpaper groups;
- one Storybook story per group;
- browser-only bitmap upload using `URL.createObjectURL`, matching the monorepo's existing local-file approach;
- serializable pre-transform and post-transform props inspired by the former Substance graph.

## Current scaffold status

The scaffold exposes all 17 group names and gives each one an independent shader mapping hook:

- rectangular family: `p1`, `p2`, `pm`, `pg`, `cm`, `pmm`, `pmg`, `pgg`, `cmm`;
- square family: `p4`, `p4m`, `p4g`;
- triangular / hexagonal family: `p3`, `p3m1`, `p31m`, `p6`, `p6m`.

The initial UV functions are intentionally a starting implementation rather than a claim of pixel-identical parity with the old Substance graph. The triangular and glide-reflection families in particular should be verified against reference fixtures before being called exact crystallographic implementations.

## Public component structure

```text
components/
  GbtScopeBitmapLoader.tsx
  GbtScopeWallpaperMaterial.tsx
  GbtScopeWallpaperViewer.tsx

materials/
  shader-wallpaper-groups.ts

wallpaper/
  groups.ts

stories/
  GbtScopeWallpaperViewer.stories.ts
```

One reusable component is preferred over 17 nearly identical React components. Storybook provides a separate named story for every group, while the `group` prop remains switchable at runtime.

## Initial top-level props

```ts
type GbtScopeWallpaperMaterialProps = {
    src: string
    group?: GbtScopeWallpaperGroup
    repeat?: [number, number]

    preOffset?: [number, number]
    preScale?: [number, number]
    preRotation?: number

    postOffset?: [number, number]
    postScale?: [number, number]
    postRotation?: number

    imageAspect?: number
    opacity?: number
}
```

The processing order is intentionally explicit:

```text
bitmap source
  -> pre transform
  -> lattice repeat
  -> wallpaper-group fold / reflection / rotation
  -> post transform
  -> texture sample
```

This leaves room to map old `.sbs` top-level parameters onto a stable browser API instead of reproducing Substance's internal graph node-for-node.

## Recommended implementation phases

### Phase 1: exact group fixtures

Create a tiny asymmetric reference bitmap containing:

- labeled corners;
- an orientation arrow;
- an off-center dot;
- distinct edge colors.

For each group, save a reference screenshot and test:

- translation period;
- reflection axes;
- rotation centers and order;
- glide direction and half-cell offset;
- square versus centered rectangular lattice behavior;
- distinction between `p3m1` and `p31m`;
- seam continuity.

Keep fixture metadata in a data file rather than hiding corrections in stories.

### Phase 2: Substance-facing preset schema

Add a serializable preset independent of React and Babylon:

```ts
type WallpaperPreset = {
    version: 1
    group: GbtScopeWallpaperGroup
    bitmap: {
        aspect: number
        source?: string
    }
    repeat: [number, number]
    pre: WallpaperTransform
    post: WallpaperTransform
    lattice?: {
        angle?: number
        centered?: boolean
    }
}
```

Then document how old Substance parameters map into this schema. Preserve original parameter names only in import adapters, not in the core API.

### Phase 3: interactive pattern lab

Add an application-level panel rather than growing the low-level viewer component:

- bitmap drag-and-drop;
- crop / contain / cover source modes;
- numeric and visual pre/post transform controls;
- group thumbnails;
- pan and zoom;
- reset and randomize;
- compare two groups side-by-side;
- save / load preset JSON.

The component package should remain usable without MUI; a richer app may compose it with the monorepo's UI packages.

### Phase 4: export and batch rendering

Add deterministic exports from the same preset:

- single tile PNG;
- full repeated canvas PNG;
- contact sheet of selected groups or parameter variants;
- high-resolution offscreen render;
- optional animation frames / video later.

The exporter should accept explicit dimensions and avoid depending on the current viewport.

## Future SVG swatch-sheet CLI

The SVG output is a **layout and interchange container for bitmap tiles**, not a vectorization system.

The rendered tile artwork remains raster. The CLI should place or embed those bitmap renders inside SVG documents so they are convenient to open and arrange in Illustrator.

Recommended outputs:

```text
output/
  tiles/
    preset-name-p4m.png
    preset-name-p6m.png
  swatch-sheet.svg
  manifest.json
```

The generated SVG can provide:

- `<image>` elements containing linked PNG paths or embedded data URLs;
- vector clipping rectangles and page boundaries;
- labels for group, preset, dimensions, seed, and parameters;
- repeat previews made with SVG `<pattern>` elements whose content is a raster `<image>`;
- one artboard-like group per swatch;
- contact-sheet spacing and printable page sizing;
- optional linked and embedded modes;
- stable IDs so Illustrator scripts can locate each swatch.

Example conceptual output:

```svg
<svg xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="swatch-p4m" width="512" height="512" patternUnits="userSpaceOnUse">
      <image href="tiles/preset-name-p4m.png" width="512" height="512" />
    </pattern>
  </defs>
  <rect width="2048" height="2048" fill="url(#swatch-p4m)" />
</svg>
```

Illustrator can then edit the page structure, clipping paths, labels, scaling, and placement while the actual pattern tile remains a bitmap. The CLI must not imply that PNG texture details have become SVG paths, and automatic image tracing should remain outside the default workflow.

Possible command shape:

```sh
pnpm wallpaper render preset.json --groups p4m,p6m --out output/tiles
pnpm wallpaper swatch-sheet output/tiles --format svg --embed
```

Later, an Illustrator-specific exporter could package the same raster tiles and metadata into an Illustrator-oriented workflow, but it should consume the same render manifest rather than becoming a second renderer.

## Other future pattern operators

Keep wallpaper groups as one operator family. Do not overload the `group` prop with unrelated effects. Future operators can share bitmap input and export infrastructure while keeping separate parameter schemas:

```text
pattern operators/
  wallpaper groups
  frieze groups
  radial / kaleidoscope
  protected-center edge unfolding
  Truchet remapping
  Wang-tile assembly
  log-polar / Droste remapping
```

A higher-level `PatternLab` can choose an operator and store a discriminated preset union.

## Definition of done for mathematical parity

A group is considered complete only when:

1. its fixture matches the expected symmetry operations;
2. seams remain continuous at multiple repeat counts;
3. non-square source aspects behave predictably;
4. pre/post transforms do not change the group classification unexpectedly;
5. its Storybook story has a stable reference image;
6. the mapping is documented well enough to compare against the old Substance output.
