// Src/db/tables/base-columns.ts
// Local copy of baseColumns for this package's table definitions.
//
// WHY a local copy instead of importing from @gbt/drizzle-blueprint:
//   drizzle-kit loads the tables barrel at schema-push time. If the table files
//   import from @gbt/drizzle-blueprint, the entire blueprint bundle loads —
//   including express-zod-api, which conflicts with zod@>=4.4 in drizzle-kit's
//   process ("Cannot redefine property: brand"). Keeping baseColumns local avoids
//   that transitive dep at schema-load time.
//
//   The services layer imports from @gbt/drizzle-blueprint safely because it is
//   not loaded by drizzle-kit.

import { sql } from 'drizzle-orm'
import { integer } from 'drizzle-orm/sqlite-core'

export const baseColumns = {
    datetime_created: integer('datetime_created', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),

    datetime_modified: integer('datetime_modified', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),

    id: integer('id').primaryKey({ autoIncrement: true }),
}

export default baseColumns
