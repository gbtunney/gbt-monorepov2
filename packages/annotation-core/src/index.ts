/**
 * `@snailicid3/annotation-core`
 *
 * Provider-independent domain model and query layer for media annotations. No React, no provider-specific parsing, no
 * assumption that analysis data exists at all — adapters normalise into these types, and viewers read from them.
 */

export * from './query.ts'
export * from './temporal.ts'
export * from './types.ts'
