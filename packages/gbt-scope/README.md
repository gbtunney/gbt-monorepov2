# @snailicid3/gbt-scope 🐌

[![npm](https://img.shields.io/npm/v/%40snailicid3%2Fgbt-scope?style=flat-square)](https://www.npmjs.com/package/@snailicid3/gbt-scope)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://prettier.io/)

_React components for rendering configurable kaleidoscope viewers._

---

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=111827)](https://react.dev/)
[![Storybook](https://img.shields.io/badge/Storybook-FF4785?style=for-the-badge&logo=storybook&logoColor=white)](https://storybook.js.org/)
[![Figma](https://img.shields.io/badge/Figma-0C8CE9?style=for-the-badge&logo=figma&logoColor=white)](https://www.figma.com/)

### Repository

- **GitHub:** [`@snailicid3/gbt-scope`](https://github.com/gbtunney/gbt-monorepov2/tree/HEAD/packages/gbt-scope) • [`gbt-monorepov2`](https://github.com/gbtunney/gbt-monorepov2)

### Author

👤 **Gillian Tunney**

- [GitHub](https://github.com/gbtunney)
- [Email](mailto:gbtunney@mac.com)

> Recommended package manager: [pnpm](https://pnpm.io/)
>
> [![pnpm](https://img.shields.io/badge/pnpm-4A4A4A?style=for-the-badge&logo=pnpm&logoColor=F69220)](https://pnpm.io/)

## @snailicid3/gbt-scope 🐌

---

`@snailicid3/gbt-scope` provides React components and supporting utilities for rendering configurable
kaleidoscope imagery.

The package includes:

- flat and three-dimensional React viewers
- a reusable Babylon.js shader material
- configurable radial symmetry, texture scaling, tiling, rotation, offset, and opacity
- unwrapped, repeated, and mirrored texture modes
- pointer- and scroll-driven animation inputs
- data-driven animator and curve utilities

## Installation

```sh
pnpm add @snailicid3/gbt-scope react react-dom
```

React and React DOM are peer dependencies and remain owned by the consuming application.

## Usage

Import components directly from the package root:

```tsx
import {
    GbtScopeFlatViewer,
    GbtScopeMeshViewer,
} from '@snailicid3/gbt-scope'
```

Render a flat kaleidoscope viewer:

```tsx
import { GbtScopeFlatViewer } from '@snailicid3/gbt-scope'

export function Kaleidoscope(): React.JSX.Element {
    return (
        <GbtScopeFlatViewer
            src="/images/source-artwork.jpg"
            segments={8}
            scaleFactor={1.25}
            tileMode="mirror"
            tiling={2}
        />
    )
}
```

### Top-level exports

The package root exports:

- `GbtScopeFlatViewer`
- `GbtScopeMeshViewer`
- `GbtScopeMaterial`
- component and material prop types
- default viewer and material properties
- animator and curve utilities
- pointer and scroll state helpers

Consumers should import from `@snailicid3/gbt-scope`; internal source paths are not part of the
public package API.

## Figma Effect

A companion Figma Effect implementation lives at
[`src/figma/shader-radial-symmetry.ts`](./src/figma/shader-radial-symmetry.ts).

It ports the radial-symmetry effect to WGSL and exposes Figma Effect controls for segments, scale,
tiling, tile mode, offset, rotation, opacity, and motion intensity. The source is currently usable
in the Figma Effects environment and is intended for publication in the Figma Community.

The Figma Effect source shares the visual model used by the React components, but it is not exported
from the `@snailicid3/gbt-scope` npm package entry point.

## Origin and attribution

The original radial-folding shader and interactive kaleidoscope concept were adapted from
[`the-lazy-god/tlg-kaleidoscope`](https://github.com/the-lazy-god/tlg-kaleidoscope) by The Lazy
God.

This package substantially modifies and extends that starting point. Its additions include:

- React and Babylon.js component integration
- a typed public component API
- data-driven pointer and scroll animation
- revised rotation and offset transforms
- explicit unwrapped, repeated, and mirrored texture modes
- configurable tiling and opacity
- a WGSL port with Figma-native Effect controls

Preserve this attribution when publishing or reusing implementations derived from the original
work.

> **Upstream license note:** No license file was found in the upstream repository during this
> review. Do not describe the upstream project as MIT-licensed unless its author or repository
> provides verifiable license terms.

## Development

Run package tasks from the repository root:

```sh
pnpm --filter=@snailicid3/gbt-scope build:nx
pnpm --filter=@snailicid3/gbt-scope test:nx
pnpm --filter=@snailicid3/gbt-scope dev:storybook
```
