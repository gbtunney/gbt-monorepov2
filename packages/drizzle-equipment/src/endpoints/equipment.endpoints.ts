// Src/endpoints/equipment.endpoints.ts
// Wires the CRUD endpoint factory (from @gbt/drizzle-blueprint) to the
// equipment service and its Zod schemas.
// Produces: create, getById, list, update, remove endpoints.

import { makeCrudEndpoints } from '@gbt/drizzle-blueprint'

import {
    equipmentInsertSchema,
    equipmentSelectSchema,
    equipmentUpdateSchema,
} from '../db/zod/equipment.zod.js'
import { equipmentService } from '../services/equipment.service.js'

export const equipmentEndpoints = makeCrudEndpoints({
    schemas: {
        create: equipmentInsertSchema,
        entity: equipmentSelectSchema,
        update: equipmentUpdateSchema,
    },
    service: equipmentService,
})

export default equipmentEndpoints
