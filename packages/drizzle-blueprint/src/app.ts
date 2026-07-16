// Src/app.ts
// Entry point. Wires config, routing, and server startup.
//
// express-zod-api v26 routing notes:
//   - createConfig() is required — do NOT pass a plain object to createServer().
//   - HTTP port is nested under `http: { listen: port }`.
//   - createServer() takes (config, routing) and returns { app, servers, logger }.
//   - In v26, DependsOnMethod was removed. Multiple HTTP methods on one path are
//     declared by nesting method-name keys inside the path object:
//       { users: { post: createEndpoint, get: listEndpoint } }
//     Keys matching HTTP methods (get/post/patch/delete/put) are treated as methods
//     by default (controlled by `methodLikeRouteBehavior`, default: "method").
//   - Routing keys are path segments. Nest objects for sub-paths:
//       { users: { ":id": getByIdEndpoint } } → /users/:id
//
// Current routing layout:
//   POST   /users        → create
//   GET    /users        → list
//   GET    /users/id     → getById   (path param wired in the endpoint input schema)
//   PATCH  /users/id     → update
//   DELETE /users/id     → remove
//   (same pattern for /orders)
//
// FIXME: getById, update, and remove are intentionally omitted from routing until
// their input schemas declare the ":id" path param:
//   add `id: z.string().transform(Number)` to each endpoint's input schema,
//   then wire them at `users: { ":id": { get: getById, patch: update, delete: remove } }`.

import type { Express } from 'express'
import { createConfig, createServer } from 'express-zod-api'
import type { Routing } from 'express-zod-api'

import { ordersEndpoints } from './endpoints/orders.endpoints.js'
import { usersEndpoints } from './endpoints/users.endpoints.js'

// ============================================================
// Config
// ============================================================
const config = createConfig({
    cors: false,
    http: {
        listen: 8090,
    },
    logger: {
        color: true,
        level: 'debug',
    },
})

// ============================================================
// Routing
// ============================================================
// In v26, nest method-name keys under the path object to handle multiple
// HTTP verbs on the same path without collisions.

const routing: Routing = {
    orders: {
        get: ordersEndpoints.list,
        post: ordersEndpoints.create,
        // FIXME: same ":id" pattern needed for orders.
    },
    users: {
        get: usersEndpoints.list,
        post: usersEndpoints.create,
        // FIXME: add ":id" sub-route once endpoint input schemas declare the path param:
        // ":id": { get: usersEndpoints.getById, patch: usersEndpoints.update, delete: usersEndpoints.remove },
    },
}

// ============================================================
// Start
// ============================================================
// createServer() is async — the returned promise resolves to { app, servers, logger }.
// Top-level await is valid in ESM; wrap in an IIFE if targeting CJS.

const result = await createServer(config, routing)
const app: Express = result.app
// eslint-disable-next-line @typescript-eslint/naming-convention
const { logger, servers } = result

logger.info('Server started', { port: 8090 })

export { app, servers }
