/**
 * The `normalize` command's core, kept framework-free and side-effect-light so it unit-tests without a CLI harness.
 *
 * Reads a raw Google Video Intelligence JSON file, runs it through `@snailicid3/annotation-adapter-google-vi`, and
 * writes two files into the output directory: the normalised annotation-core document, and a verbatim copy of the raw
 * input (so the derivative always travels with its source).
 */

import { adaptGoogleVideoIntelligence } from '@snailicid3/annotation-adapter-google-vi'
import { type AnalysisRun, type Annotation } from '@snailicid3/annotation-core'

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

/** The serialised document written to `<stem>.normalized.json`. */
export type NormalizedDocument = {
    analysisRun: AnalysisRun
    annotations: Array<Annotation>
    mediaId: string
}

/** Inputs for {@link runNormalize}. `outDir` defaults to the current directory. */
export type NormalizeOptions = {
    file: string
    mediaId: string
    outDir?: string
    provider?: string
}

/** Where {@link runNormalize} wrote its output and how much it produced. */
export type NormalizeResult = {
    annotationCount: number
    normalizedPath: string
    rawPath: string
    runId: string
}

/** Strip a single trailing `.json` (case-insensitive) to derive the output filename stem. */
const stemOf = (filePath: string): string =>
    basename(filePath).replace(/\.json$/iu, '')

/**
 * Normalise one raw Google Video Intelligence file, writing `<stem>.normalized.json` and `<stem>.raw.json` into
 * `outDir` (created if missing). Returns the written paths, the analysis-run id, and the annotation count.
 */
export const runNormalize = async (
    options: NormalizeOptions,
): Promise<NormalizeResult> => {
    const rawText = await readFile(options.file, 'utf8')

    const { analysisRun, annotations } = adaptGoogleVideoIntelligence(rawText, {
        mediaId: options.mediaId,
        ...(options.provider === undefined
            ? {}
            : { provider: options.provider }),
    })

    const outDir = resolve(options.outDir ?? '.')
    await mkdir(outDir, { recursive: true })

    const stem = stemOf(options.file)
    const normalizedPath = join(outDir, `${stem}.normalized.json`)
    const rawPath = join(outDir, `${stem}.raw.json`)

    const document: NormalizedDocument = {
        analysisRun,
        annotations,
        mediaId: options.mediaId,
    }

    await writeFile(normalizedPath, `${JSON.stringify(document, null, 4)}\n`)
    await writeFile(rawPath, `${rawText.trimEnd()}\n`)

    return {
        annotationCount: annotations.length,
        normalizedPath,
        rawPath,
        runId: analysisRun.id,
    }
}
