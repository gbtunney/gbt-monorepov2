// Src/db/tables/index.ts
// Tables barrel. This is what drizzle-kit's `schema` config points at.
// Only export table definitions and base columns from here.
// Do NOT export Zod schemas from this barrel.

export * from './base-columns.js'
export * from './orders.table.js'
// Table-factory is a helper utility, not a table definition.
// Export it here if you want it accessible from the tables layer,
// but drizzle-kit ignores it since it produces no table instances itself.
export * from './table-factory.js'

export * from './users.table.js'
