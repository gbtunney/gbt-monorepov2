// Src/db/zod/categories.zod.ts
// Zod schemas derived from the categories table via drizzle-zod.
// createSelectSchema / createInsertSchema / createUpdateSchema mirror the
// column definitions so API validation stays in sync with the DB schema.

import {
    createInsertSchema,
    createSelectSchema,
    createUpdateSchema,
} from 'drizzle-zod'

import { categories } from '../tables/categories.table.js'

export const categorySelectSchema = createSelectSchema(categories)
export const categoryInsertSchema = createInsertSchema(categories)
export const categoryUpdateSchema = createUpdateSchema(categories)
