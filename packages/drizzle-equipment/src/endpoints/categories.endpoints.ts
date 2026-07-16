// Src/endpoints/categories.endpoints.ts
// Wires the CRUD endpoint factory (from @gbt/drizzle-blueprint) to the
// categories service and its Zod schemas.
// Produces: create, getById, list, update, remove endpoints.

import { makeCrudEndpoints } from '@gbt/drizzle-blueprint'

import {
    categoryInsertSchema,
    categorySelectSchema,
    categoryUpdateSchema,
} from '../db/zod/categories.zod.js'
import { categoriesService } from '../services/categories.service.js'

export const categoriesEndpoints = makeCrudEndpoints({
    schemas: {
        create: categoryInsertSchema,
        entity: categorySelectSchema,
        update: categoryUpdateSchema,
    },
    service: categoriesService,
})

export default categoriesEndpoints
