# @snailicid3/annotation-core

Provider-independent domain model and query layer for media annotations.

No React, no provider-specific parsing, and no assumption that machine analysis exists at all.
Adapters normalise provider payloads _into_ these types; viewers and CLI tools read _from_ them.

## Why this package exists separately

The proof-of-concept viewer had `parse.ts`, `select.ts`, and `types.ts` doing double duty — half
generic query logic, half Google Video Intelligence JSON shape. Splitting that seam means the query
layer can be built and tested against a handful of plain objects instead of a 31MB fixture and a
running video element.

## The model in one paragraph

Everything is an **annotation**: an id, a label, an origin (machine / human / import / app), an
open-ended `kind`, and a **temporal target** saying where in time it applies. Temporal targets are
`whole`, `point`, or `interval`. A **spatial target** — `point` or `region` — is optional, because
plenty of annotation types have no on-screen position at all. Annotations that belong to one
continuous subject share a `trackId`, which is what lets one timeline component render a row per
tracked person, per identified face, or per rehearsal take.

## Usage

```ts
import { queryAnnotations } from '@snailicid3/annotation-core'

const { counts, items, tracks } = queryAnnotations(annotations, {
  confidenceMin: 0.5,
  kinds: ['label', 'object'],
  range: [12, 48],
  text: 'bread',
})
```

`items` is what renders. `counts` is tallied _before_ hidden kinds are dropped, so a hidden track's
badge still shows how much is hidden. `tracks` groups by `trackId` for per-subject rows.

## Rebasing

`rebaseToSegment` shifts a target from the source media's absolute timeline onto a segment's own
0-based timeline, and `rebaseFromSegment` goes back. This is what keeps an annotation authored
against a two-hour recording landing in the right place inside a ninety-second clip exported from
it.

A segment is a _reference_, not a file — it can be played, annotated, and listed as a chapter with
nothing exported.
