# @snailicid3/gbt-scope

React components for rendering GBT Scope kaleidoscope viewers.

### Repository

- **GitHub:**
  [`@snailicid3/gbt-scope`](https://github.com/gbtunney/gbt-monorepov2/tree/main/packages/gbt-scope)
  in [`gbt-monorepov2`](https://github.com/gbtunney/gbt-monorepov2)

### Shader attribution

The radial-symmetry / kaleidoscope shader in
[`src/materials/shader-radial-symmetry.ts`](./src/materials/shader-radial-symmetry.ts) was originally
based on [`the-lazy-god/tlg-kaleidoscope`](https://github.com/the-lazy-god/tlg-kaleidoscope), which is
licensed under the MIT License.

The implementation in this package has since been modified and extended, including changes to the
shader logic and controls. Preserve this attribution when reusing or publishing derived versions.

### Usage

Run from the repository root:

```sh
pnpm --filter=@snailicid3/gbt-scope build:nx
pnpm --filter=@snailicid3/gbt-scope dev:storybook
pnpm --filter=@snailicid3/gbt-scope build:storybook:nx
pnpm --filter=@snailicid3/gbt-scope test:nx
```

Chromatic runs through its own Nx target and needs `CHROMATIC_GBT_SCOPE_PROJECT_TOKEN` in `.env` at
the package root. See `.env.example`.
