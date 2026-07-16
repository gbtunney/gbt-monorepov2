// Src/db/zod/equipment.zod.ts
// Zod schemas derived from the equipment table via drizzle-zod.
//
// Status override: drizzle-zod produces z.string() for the `status` column because
// SQLite has no native enum. We extend the insert and update schemas to narrow it
// to the allowed values. The select schema is left as-is since rows in the DB
// already passed insert/update validation.

import {
    createInsertSchema,
    createSelectSchema,
    createUpdateSchema,
} from 'drizzle-zod'
import { z } from 'zod'

import { equipment } from '../tables/equipment.table.js'

export const equipmentStatusSchema = z.enum([
    'available',
    'in_use',
    'maintenance',
])

export type EquipmentStatus = z.infer<typeof equipmentStatusSchema>

export const equipmentSelectSchema = createSelectSchema(equipment)

export const equipmentInsertSchema = createInsertSchema(equipment).extend({
    status: equipmentStatusSchema.optional().default('available'),
})

export const equipmentUpdateSchema = createUpdateSchema(equipment).extend({
    status: equipmentStatusSchema.optional(),
})
