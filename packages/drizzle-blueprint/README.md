# Drizzle + SQLite + Zod + express-zod-api Blueprint

A TypeScript ESM project blueprint providing a fully layered, reusable API server stack.

---

## Stack

- **TypeScript** (ESM, explicit `.js` imports in source)
- **SQLite** via `better-sqlite3`
- **Drizzle ORM** + `drizzle-kit` for migrations
- **Zod** via `drizzle-orm/zod` for schema-derived validation
- **express-zod-api** v22+ for typed HTTP endpoints

### Install peer dependencies

```bash
pnpm add drizzle-orm better-sqlite3 zod express-zod-api express http-errors
pnpm add -D drizzle-kit @types/better-sqlite3 @types/express @types/node @types/http-errors typescript
```

### Required `tsconfig.json` options

```json
{
  "compilerOptions": {
    "strict": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

---

## Directory structure

```txt
src/
  db/
    db.ts                     # Connection only
    tables/
      base-columns.ts         # Shared id, datetime_created, datetime_modified
      table-factory.ts        # Optional: makeAppTable() convenience wrapper
      users.table.ts
      orders.table.ts
      index.ts                # Tables barrel — this is what drizzle-kit reads
    zod/
      users.zod.ts
      orders.zod.ts
      index.ts                # Validation barrel — use this in app code

  services/
    makeCrudService.ts        # Generic CRUD factory (create/getById/list/update/remove)
    makeQueryHelpers.ts       # Generic typed query helper factory
    users.service.ts
    orders.service.ts
    index.ts

  endpoints/
    makeCrudEndpoints.ts      # Generic express-zod-api endpoint factory
    users.endpoints.ts
    orders.endpoints.ts
    index.ts

  app.ts                      # Server entry point

drizzle.config.ts
```

---

## Layer responsibilities

### `db/db.ts`

Connection only. One export: `db`. Do not add schema, services, or endpoints here.

### `db/tables/`

Drizzle table definitions — the schema source of truth. `drizzle-kit` points here (via `index.ts`).
Every table spreads `baseColumns` for `id`, `datetime_created`, `datetime_modified`.

> **Note:** SQLite does not auto-update `datetime_modified` on UPDATE. `makeCrudService` patches it
> automatically in `update()`.

### `db/zod/`

Zod schemas derived from tables using `createSelectSchema`, `createInsertSchema`,
`createUpdateSchema` from `drizzle-orm/zod`. Used for runtime validation in services and endpoints.
Do **not** point `drizzle-kit` here.

### `services/makeCrudService.ts`

Generic CRUD factory. Works at the **row level** using `InferSelectModel` / `InferInsertModel`.
Exports the `CrudService<TSelect, TInsert, TUpdate>` type — import this in `makeCrudEndpoints.ts`
instead of redeclaring it.

### `services/makeQueryHelpers.ts`

Generic typed query helper factory. Works at the **column level** using:

```ts
type ColumnValue<TColumn extends SQLiteColumn> = TColumn['_']['data']
```

This infers the correct argument type from whatever column you pass in. Helpers:

| Helper                      | Description                                                         |
| --------------------------- | ------------------------------------------------------------------- |
| `findManyBy(col)`           | All rows where `col = value`                                        |
| `findOneBy(col)`            | First match or null                                                 |
| `findOneByStrict(col)`      | First match or null — throws if >1 row found                        |
| `findManyByAnd(colA, colB)` | AND filter across two columns                                       |
| `findManyByOr(colA, colB)`  | OR filter across two columns                                        |
| `searchBy(col)`             | `LIKE %pattern%` — **text columns only** (enforced at compile time) |

### `services/*.service.ts`

Per-table services that compose CRUD + query helpers. Example:

```ts
export const usersService = {
  ...makeCrudService(users, users.id),
  getByEmail: q.findOneByStrict(users.email),
  searchByName: q.searchBy(users.name),
}
```

### `endpoints/makeCrudEndpoints.ts`

Generic CRUD endpoint factory for `express-zod-api`. Takes a service + three Zod schemas and
produces `create / getById / list / update / remove` endpoints. Imports `CrudService` from
`makeCrudService.ts` — not redeclared.

### `endpoints/*.endpoints.ts`

Per-table endpoint wiring. Composes the factory with a service and schemas.

---

## Key design rules

- `drizzle-kit` reads **only** `src/db/tables/index.ts` — never the zod barrel
- `db.ts` stays tiny — one export, no schema
- `makeCrudService` uses row-level typing; `makeQueryHelpers` uses column-level typing — keep these
  separate
- `findOneByStrict()` is a runtime guard only — also enforce uniqueness at the DB level (`.unique()`
  on the column)
- `searchBy()` rejects non-text columns at compile time by design

---

## Reusable stack

```txt
base columns
  ↓
table definitions
  ↓
Zod schema generation
  ↓
generic CRUD service factory        ← makeCrudService.ts
  ↓
generic typed query helper factory  ← makeQueryHelpers.ts
  ↓
per-table services
  ↓
generic CRUD endpoint factory       ← makeCrudEndpoints.ts
  ↓
per-table endpoints
  ↓
app.ts (routing + server)
```

The three generic engines are: `makeCrudService`, `makeQueryHelpers`, `makeCrudEndpoints`.

---

## express-zod-api v22+ notes

Config now uses `createConfig()` with `http: { listen: port }`:

```ts
const config = createConfig({
  http: { listen: 8090 },
  cors: false,
  logger: { level: 'debug', color: true },
})
```

`createServer()` is async and returns `{ app, servers, logger }`:

```ts
const { app, servers, logger } = await createServer(config, routing)
```

Use `DependsOnMethod` to handle multiple HTTP verbs at one path:

```ts
const routing: Routing = {
  users: new DependsOnMethod({
    post: usersEndpoints.create,
    get: usersEndpoints.list,
  }),
}
```

For `getById / update / remove`, add a `":id"` sub-route and declare the path param in the
endpoint's input schema:

```ts
// in the endpoint input schema:
input: z.object({
  id: z.string().transform(Number),
}),

// in routing:
users: {
  ":id": new DependsOnMethod({
    get:    usersEndpoints.getById,
    patch:  usersEndpoints.update,
    delete: usersEndpoints.remove,
  }),
},
```

> **Zod version:** express-zod-api v24+ requires Zod 4.x. For Zod 3.x, pin `express-zod-api` below
> `24.0.0`.

---

## Migrations

```bash
# Generate migration files
pnpm exec drizzle-kit generate

# Apply migrations
pnpm exec drizzle-kit migrate

# Push schema directly (dev only)
pnpm exec drizzle-kit push
```

`drizzle.config.ts` points at `src/db/tables/index.ts` and outputs to `./drizzle/`.

---

## Known TODOs

- `idColumn: TTable["id"]` in `makeCrudService` may widen to `unknown` in strict mode. Tighter fix:
  type it as `SQLiteColumn` from `drizzle-orm/sqlite-core`.
- `makeCrudEndpoints` passes `z.ZodType` as the `input` schema. `express-zod-api` expects
  `ZodObject` — this works with raw `createInsertSchema()` output but will break if you wrap schemas
  in `.refine()` or `.transform()`. Unwrap with `.innerType()` if needed.
- `getById / update / remove` endpoints need path param support wired in before they can be routed
  at `/users/:id`. See the stub comment in `app.ts`.
