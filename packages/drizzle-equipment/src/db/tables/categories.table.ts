// Src/db/tables/categories.table.ts
// Table definition for `categories`.
// Anchor table — no FK dependencies, so defined before equipment.
//
// Imports baseColumns from @gbt/drizzle-blueprint (schema helper, no db dependency).

import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { baseColumns } from './base-columns.js'

export const categories = sqliteTable('categories', {
    ...baseColumns,

    description: text('description'),

    // Unique at DB level — service uses findOneByStrict for name lookups.
    name: text('name').notNull().unique(),
})

export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert
