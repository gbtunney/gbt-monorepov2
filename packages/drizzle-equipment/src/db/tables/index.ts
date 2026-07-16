// Src/db/tables/index.ts
// Tables barrel — this is what drizzle.config.ts schema points at.
// Export only table definitions from here.
// Do NOT export Zod schemas from this barrel (drizzle-kit ignores them, but it keeps
// the schema layer clean).

export * from './categories.table.js'
export * from './equipment.table.js'
