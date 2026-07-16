// Drizzle.config.ts
// Drizzle Kit configuration for the equipment database.
// Points at the TABLES barrel only — not the zod/ barrel.
// Run from packages/drizzle-equipment: pnpm exec drizzle-kit push

import { defineConfig } from 'drizzle-kit'

export default defineConfig({
    dbCredentials: {
        url: './dev.db',
    },
    dialect: 'sqlite',
    out: './drizzle',
    schema: './src/db/tables/index.ts',
})
