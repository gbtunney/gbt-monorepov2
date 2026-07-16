// Src/index.ts
// @gbt/drizzle-blueprint public API.
//
// Re-exports everything needed by consumer packages:
//   - DB utilities: baseColumns, makeAppTable, table types
//   - Zod schemas: select / insert / update for all tables
//   - Service factories: makeCrudService, makeQueryHelpers (accept db as first param)
//   - Endpoint factory: makeCrudEndpoints
//   - Domain services/endpoints from the blueprint itself (users, orders)
//   - db: the blueprint's own SQLite connection (re-exported for consumers that
//         want to share it; most consumers should create their own db instead)

// Blueprint's own db connection — re-exported so consumers can optionally share it.
// Most consumers should create their own drizzle(sqlite) instance instead.
export { db } from './db/db.js'

// DB layer — table definitions, base columns, table factory
export * from './db/tables/index.js'

// Zod schemas derived from the blueprint's tables
export * from './db/zod/index.js'

// Endpoint factory + blueprint's own endpoints
export * from './endpoints/index.js'

// Service factories (DI: accept db as first param) + blueprint's own services
export * from './services/index.js'
