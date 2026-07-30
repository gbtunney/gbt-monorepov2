import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { type NormalizedDocument, runNormalize } from './normalize.ts'

/** A tiny snake_case Google VI payload: one shot label, one shot, one explicit frame → 3 annotations. */
const rawFixture = JSON.stringify({
    annotation_results: [
        {
            explicit_annotation: {
                frames: [
                    {
                        pornography_likelihood: 'VERY_UNLIKELY',
                        time_offset: { seconds: 0 },
                    },
                ],
            },
            shot_annotations: [
                {
                    end_time_offset: { seconds: 5 },
                    start_time_offset: { seconds: 0 },
                },
            ],
            shot_label_annotations: [
                {
                    entity: { description: 'bread' },
                    segments: [
                        {
                            confidence: 0.9,
                            segment: {
                                end_time_offset: { seconds: 5 },
                                start_time_offset: { seconds: 0 },
                            },
                        },
                    ],
                },
            ],
        },
    ],
})

let workDir: string
let inputPath: string

beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'annotation-cli-'))
    inputPath = join(workDir, 'result.json')
    await writeFile(inputPath, rawFixture)
})

afterEach(async () => {
    await rm(workDir, { force: true, recursive: true })
})

describe('runNormalize', () => {
    it('writes a normalised document and reports what it produced', async () => {
        const result = await runNormalize({
            file: inputPath,
            mediaId: 'media-x',
            outDir: workDir,
        })

        expect(result.annotationCount).toBe(3)
        expect(result.runId).toBe('media-x:google-vi')
        expect(result.normalizedPath).toBe(
            join(workDir, 'result.normalized.json'),
        )
        expect(result.rawPath).toBe(join(workDir, 'result.raw.json'))

        const document = JSON.parse(
            await readFile(result.normalizedPath, 'utf8'),
        ) as NormalizedDocument
        expect(document.mediaId).toBe('media-x')
        expect(document.annotations).toHaveLength(3)
        expect(document.analysisRun.provider).toBe('google-video-intelligence')
        expect(document.annotations.every((a) => a.origin === 'machine')).toBe(
            true,
        )
    })

    it('preserves the raw input verbatim alongside the normalised output', async () => {
        const result = await runNormalize({
            file: inputPath,
            mediaId: 'media-x',
            outDir: workDir,
        })

        const raw = await readFile(result.rawPath, 'utf8')
        expect(raw.trimEnd()).toBe(rawFixture.trimEnd())
    })

    it('records a custom provider label on the run', async () => {
        const result = await runNormalize({
            file: inputPath,
            mediaId: 'media-x',
            outDir: workDir,
            provider: 'google-vi@v1p3',
        })

        const document = JSON.parse(
            await readFile(result.normalizedPath, 'utf8'),
        ) as NormalizedDocument
        expect(document.analysisRun.provider).toBe('google-vi@v1p3')
    })
})
