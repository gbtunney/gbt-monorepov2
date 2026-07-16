// Src/db/zod/users.zod.ts
// Zod schemas derived from the users table definition.
// These are used for runtime validation (API input/output, endpoint factories).
// Do NOT point drizzle-kit at this file — it only needs the tables barrel.
//
// createSelectSchema — validates a full row as returned from a SELECT
// createInsertSchema — validates input for INSERT (id/timestamps optional)
// createUpdateSchema — validates input for UPDATE (all fields partial)

import {
    createInsertSchema,
    createSelectSchema,
    createUpdateSchema,
} from 'drizzle-zod'

import { users } from '../tables/users.table.js'

export const userSelectSchema = createSelectSchema(users)
export const userInsertSchema = createInsertSchema(users)
export const userUpdateSchema = createUpdateSchema(users)
