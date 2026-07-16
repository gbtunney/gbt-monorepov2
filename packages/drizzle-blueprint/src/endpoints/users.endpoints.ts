// Src/endpoints/users.endpoints.ts
// Wires the generic CRUD endpoint factory to the users service and Zod schemas.
// Custom endpoints (e.g. search by name) should be added here as additional
// defaultEndpointsFactory.build() calls — outside of makeCrudEndpoints.

import { makeCrudEndpoints } from './makeCrudEndpoints.js'
import {
    userInsertSchema,
    userSelectSchema,
    userUpdateSchema,
} from '../db/zod/users.zod.js'
import { usersService } from '../services/users.service.js'

export const usersEndpoints = makeCrudEndpoints({
    schemas: {
        create: userInsertSchema,
        entity: userSelectSchema,
        update: userUpdateSchema,
    },
    service: usersService,
})

export default usersEndpoints
