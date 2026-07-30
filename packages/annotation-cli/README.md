# @snailicid3/annotation-cli

CLI for turning **Google Cloud Video Intelligence** output into the provider-neutral
[`@snailicid3/annotation-core`](../annotation-core) model, via
[`@snailicid3/annotation-adapter-google-vi`](../annotation-adapter-google-vi).

Built on [`@snailicid3/cli-app`](https://www.npmjs.com/package/@snailicid3/cli-app) (a Zod-backed
yargs framework).

## `normalize`

Reads a raw Google VI JSON file, runs it through the adapter, and writes two files into the output
directory: the normalised annotation-core document, and a verbatim copy of the raw input.

```sh
annotation-cli --file result.json --media-id my-video --out-dir ./out
# aliases: -i (file), -m (media-id)
```

Flags:

| Flag         | Alias | Description                                                       |
| ------------ | ----- | ----------------------------------------------------------------- |
| `--file`     | `-i`  | Raw Google Video Intelligence JSON file to normalise (required)   |
| `--media-id` | `-m`  | Stable app-level media id recorded on every annotation (required) |
| `--out-dir`  |       | Output directory (from `cli-app`'s common flags; defaults to cwd) |
| `--provider` |       | Provider label recorded on the analysis run                       |

Output for `result.json`:

- `result.normalized.json` — `{ mediaId, analysisRun, annotations }` (annotation-core shapes)
- `result.raw.json` — the untouched input, kept beside its derivative

The normalise logic is also exposed as a plain function for programmatic use:

```ts
import { runNormalize } from '@snailicid3/annotation-cli'

const { annotationCount, normalizedPath } = await runNormalize({
  file: 'result.json',
  mediaId: 'my-video',
  outDir: './out',
})
```

## Not yet implemented

`analyze <gcs-uri>` — call the Google Video Intelligence API directly on a GCS object, then
normalise the result — is a planned second command. It needs `@google-cloud/video-intelligence` +
`@google-cloud/storage` and GCP credentials, so it is deferred until those are wired in.
