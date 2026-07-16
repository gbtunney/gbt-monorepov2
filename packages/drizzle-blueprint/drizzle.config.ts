// Drizzle.config.ts
// Drizzle Kit configuration. Points at the TABLES barrel only.
// Do NOT point at the zod/ barrel — drizzle-kit only needs the schema graph.

import { defineConfig } from 'drizzle-kit'

export default defineConfig({
    dbCredentials: {
        url: './dev.db',
    },
    dialect: 'sqlite',
    out: './drizzle',
    schema: './src/db/tables/index.ts',
})
