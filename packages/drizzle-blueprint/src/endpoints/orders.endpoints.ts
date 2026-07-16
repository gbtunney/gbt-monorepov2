// Src/endpoints/orders.endpoints.ts
// Wires the generic CRUD endpoint factory to the orders service and Zod schemas.
// Custom endpoints (e.g. listByUserId, searchProducts) should be added here
// as additional defaultEndpointsFactory.build() calls outside makeCrudEndpoints.

import { makeCrudEndpoints } from './makeCrudEndpoints.js'
import {
    orderInsertSchema,
    orderSelectSchema,
    orderUpdateSchema,
} from '../db/zod/orders.zod.js'
import { ordersService } from '../services/orders.service.js'

export const ordersEndpoints = makeCrudEndpoints({
    schemas: {
        create: orderInsertSchema,
        entity: orderSelectSchema,
        update: orderUpdateSchema,
    },
    service: ordersService,
})

export default ordersEndpoints
