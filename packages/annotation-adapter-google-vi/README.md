# @snailicid3/annotation-adapter-google-vi

Normalises **Google Cloud Video Intelligence** API JSON into the provider-neutral
[`@snailicid3/annotation-core`](../annotation-core) model.

Adapters normalise provider payloads _into_ the core types; viewers and CLI tools read _from_ them.
This package depends on annotation-core for the target types only — no React, no UI.

## Usage

```ts
import { adaptGoogleVideoIntelligence } from '@snailicid3/annotation-adapter-google-vi'

const { annotations, analysisRun } = adaptGoogleVideoIntelligence(rawJsonStringOrObject, {
  mediaId: 'my-video',
})
// `annotations` is an Annotation[] ready for @snailicid3/annotation-core's queryAnnotations().
// `analysisRun` records the provider/version/status that produced them.
```

`adaptGoogleVideoIntelligence` accepts a JSON string or an already-parsed object and validates it
with the curated schema (see below), throwing a friendly error on malformed input.

## Feature → annotation mapping

| Google feature                 | `kind`       | temporal target                  | `trackId`                                | notes                                           |
| ------------------------------ | ------------ | -------------------------------- | ---------------------------------------- | ----------------------------------------------- |
| `shot_label` + `segment_label` | `label`      | interval per occurrence          | `label:<desc>` (dedupe by name)          | `payload.scope`, `payload.categories`           |
| `object_annotations`           | `object`     | interval (segment or frame span) | `object:<r>:<i>` (unique, **no** dedupe) | `payload.frames` = `[{ time, box }]`            |
| person tracks                  | `person`     | interval (segment or frame span) | `person:<r>:<p>:<t>`                     | `payload.frames` = `[{ time, box, landmarks }]` |
| `shot_annotations`             | `shot`       | interval                         | —                                        | label `Shot <n>`                                |
| `text_annotations`             | `text`       | interval per appearance          | `text:<string>`                          | `payload.frames` = rotated-box vertices         |
| `speech_transcriptions`        | `transcript` | interval over word timings       | `transcript:<r>:<i>`                     | best alternative; `payload.words`               |
| explicit-content frames        | `explicit`   | **point**                        | `explicit`                               | `payload.level` = ordinal 0–5                   |

Two API collation rules carry through (confirmed against real output): **labels dedupe by name** —
every occurrence of a description shares a `trackId`; **objects do not** — each tracked instance is
its own record, even when two share a description. The untouched Google sub-object is preserved on
every annotation's `raw` field for reprocessing and provider-only fields.

## Schema strategy: curated (now) + reference (TODO)

The runtime parser is a **curated** Zod schema (`src/google-vi-schema.ts`): thin, hand-maintained,
matching the actual snake_case data, and covering only the features normalised here. It carries
domain knowledge a generic generator cannot infer (a missing `time_offset` means `0s`; `seconds` may
arrive as a numeric string).

**TODO — reference/drift-detection half.** Add `@google-cloud/video-intelligence` as a
`devDependency` and generate a _reference_ schema from Google's `.proto` (e.g. a `protoc`/`buf`
plugin), then add a test asserting the curated schema stays compatible with it — so a field Google
renames or removes surfaces in CI without coupling the runtime to Google's (camelCase, exhaustive)
generated types. Deferred pending a toolchain decision.
