// Src/db/tables/users.table.ts
// Table definition for `users`. This is the schema source of truth for this entity.
// Drizzle-kit reads this file (via the tables barrel).
//
// Exported types:
//   User    — inferred SELECT shape (includes id, datetime_*)
//   NewUser — inferred INSERT shape (id and timestamps are optional/generated)

import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { baseColumns } from './base-columns.js'

export const users = sqliteTable('users', {
    ...baseColumns,

    // `.unique()` enforces uniqueness at the DB level.
    // findOneByStrict(users.email) does a runtime check on top of this.
    email: text('email').notNull().unique(),

    name: text('name').notNull(),
})

export type NewUser = typeof users.$inferInsert
export type User = typeof users.$inferSelect
