// Src/db/zod/index.ts
// Validation barrel. Use this in app code (services, endpoints, etc.).
// Do NOT point drizzle-kit at this barrel — it only needs the tables barrel.

export * from './categories.zod.js'
export * from './equipment.zod.js'
