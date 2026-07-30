#!/usr/bin/env node
// Thin executable launcher: loads the built ESM bundle and runs the CLI. The specifier is computed (not a static
// string) so it resolves relative to this file at runtime and stays out of static import-resolution checks.
const entry = new URL('../dist/index.mjs', import.meta.url).href
const { main } = await import(entry)
await main()
