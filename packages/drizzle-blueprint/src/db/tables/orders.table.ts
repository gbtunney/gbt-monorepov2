// Src/db/tables/orders.table.ts
// Table definition for `orders`. This is the schema source of truth for this entity.
// Demonstrates a foreign-key relationship: orders.userId -> users.id.
//
// Exported types:
//   Order    — inferred SELECT shape
//   NewOrder — inferred INSERT shape

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { baseColumns } from './base-columns.js'
import { users } from './users.table.js'

export const orders = sqliteTable('orders', {
    ...baseColumns,

    product: text('product').notNull(),

    status: text('status').notNull(),
    // Foreign key to users.id. Enforced at the DB level (foreign_keys = ON in db.ts).
    userId: integer('user_id')
        .notNull()
        .references(() => users.id),
})

export type NewOrder = typeof orders.$inferInsert
export type Order = typeof orders.$inferSelect
