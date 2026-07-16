// Src/db/tables/equipment.table.ts
// Table definition for `equipment`.
// References categories.id via nullable FK.
//
// Status is a text column constrained by application logic to:
//   'available' | 'in_use' | 'maintenance'
// SQLite has no native enum type; the Zod schema enforces the constraint at the API
// boundary (equipment.zod.ts). The DB-level default is 'available'.
//
// Imports baseColumns from @gbt/drizzle-blueprint (schema helper, no db dependency).

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { baseColumns } from './base-columns.js'
import { categories } from './categories.table.js'

export const equipment = sqliteTable('equipment', {
    ...baseColumns,

    // FK to categories.id. Nullable — equipment can be uncategorized.
    categoryId: integer('category_id').references(() => categories.id),

    description: text('description'),

    // Physical location label — free-form, nullable.
    location: text('location'),

    name: text('name').notNull(),

    // Unique at DB level — service uses findOneByStrict for serial lookups.
    serialNumber: text('serial_number').notNull().unique(),

    // Application-level enum enforced by Zod: 'available' | 'in_use' | 'maintenance'.
    status: text('status').notNull().default('available'),
})

export type Equipment = typeof equipment.$inferSelect
export type NewEquipment = typeof equipment.$inferInsert
