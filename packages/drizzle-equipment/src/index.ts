// Src/index.ts
// @gbt/drizzle-equipment public API.
//
// Exports:
//   - Table types: Category, NewCategory, Equipment, NewEquipment
//   - Zod schemas: select / insert / update for both tables
//   - EquipmentStatus type and enum schema
//   - Services: categoriesService, equipmentService
//   - Endpoints: categoriesEndpoints, equipmentEndpoints
//
// Does NOT re-export @gbt/drizzle-blueprint's factories (makeCrudService, etc.).
// Consumers that need those should depend on @gbt/drizzle-blueprint directly.

// DB layer — table types and column definitions
export * from './db/tables/index.js'

// Zod schemas + EquipmentStatus
export * from './db/zod/index.js'

// Endpoints
export * from './endpoints/index.js'

// Services
export * from './services/index.js'
