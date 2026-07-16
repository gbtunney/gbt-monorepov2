// Src/endpoints/makeCrudEndpoints.ts
// Generic CRUD endpoint factory for express-zod-api.
// Builds the five standard CRUD endpoints from a service + Zod schemas.
//
// Imports CrudService from makeCrudService.ts — do NOT redeclare that type here.
// This keeps the service contract in a single place.
//
// FIXME: express-zod-api expects `input` to be a z.ZodObject, not z.ZodType.
// This works with raw createInsertSchema() / createUpdateSchema() output since
// drizzle-orm/zod returns ZodObject. It will break if you wrap schemas in
// .refine() or .transform() — unwrap with .innerType() in that case.
//
// FIXME: removed stale v10 note — current API (v22+) still uses createServer(config, routing).
// See app.ts for the correct v22+ createConfig() shape.

import { defaultEndpointsFactory } from 'express-zod-api'
import type { Routing } from 'express-zod-api'
import { z } from 'zod'

// Import CrudService type from the factory — not redeclared here.
import type { CrudService } from '../services/makeCrudService.js'

type CrudEndpoint = Routing[string]

type CrudEndpoints = {
    create: CrudEndpoint
    getById: CrudEndpoint
    list: CrudEndpoint
    remove: CrudEndpoint
    update: CrudEndpoint
}

export function makeCrudEndpoints<
    TCreateInput extends object,
    TUpdateInput extends object,
    TEntity,
>(config: {
    schemas: {
        create: z.ZodType<TCreateInput>
        entity: z.ZodType<TEntity>
        update: z.ZodType<TUpdateInput>
    }

    service: CrudService<TEntity, TCreateInput, TUpdateInput>
}): CrudEndpoints {
    // ---- POST / create ----
    const create = defaultEndpointsFactory.build({
        handler: async ({ input }) => ({
            item: await config.service.create(input),
        }),
        input: config.schemas.create,
        method: 'post',
        output: z.object({
            item: config.schemas.entity,
        }),
    })

    // ---- GET / getById ----
    const getById = defaultEndpointsFactory.build({
        handler: async ({ input }) => ({
            item: await config.service.getById(input.id),
        }),
        input: z.object({
            id: z.number().int().positive(),
        }),
        method: 'get',
        output: z.object({
            item: config.schemas.entity.nullable(),
        }),
    })

    // ---- GET / list ----
    const list = defaultEndpointsFactory.build({
        handler: async () => ({
            items: await config.service.list(),
        }),
        input: z.object({}),
        method: 'get',
        output: z.object({
            items: z.array(config.schemas.entity),
        }),
    })

    // ---- PATCH / update ----
    const update = defaultEndpointsFactory.build({
        handler: async ({ input }) => ({
            item: await config.service.update(input.id, input.data),
        }),
        input: z.object({
            data: config.schemas.update,
            id: z.number().int().positive(),
        }),
        method: 'patch',
        output: z.object({
            item: config.schemas.entity.nullable(),
        }),
    })

    // ---- DELETE / remove ----
    const remove = defaultEndpointsFactory.build({
        handler: async ({ input }) => ({
            item: await config.service.remove(input.id),
        }),
        input: z.object({
            id: z.number().int().positive(),
        }),
        method: 'delete',
        output: z.object({
            item: config.schemas.entity.nullable(),
        }),
    })

    return {
        create,
        getById,
        list,
        remove,
        update,
    }
}
export default makeCrudEndpoints
