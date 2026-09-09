# @snailicid3/gbt-scope

React components for rendering GBT Scope kaleidoscope viewers.

### Repository

- **GitHub:**
  [`@snailicid3/gbt-scope`](https://github.com/gbtunney/gbt-monorepov2/tree/main/packages/gbt-scope)
  in [`gbt-monorepov2`](https://github.com/gbtunney/gbt-monorepov2)

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
