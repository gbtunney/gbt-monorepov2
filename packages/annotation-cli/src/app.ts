/**
 * The CLI wiring: a single `@snailicid3/cli-app` command whose flags are a Zod schema. Kept thin — all real work lives
 * in {@link runNormalize} — so this file needs no unit tests of its own (it is exercised by running the built bin).
 */

import {
    type AppConfigIn,
    commonFlagsSchema,
    initApp,
    type InitSuccessCallback,
} from '@snailicid3/cli-app'
import { z } from 'zod'

import { runNormalize } from './normalize.ts'

/** CLI flags. `commonFlagsSchema` contributes `--out-dir` (normalised to absolute) and `--debug`. */
export const optionsSchema = z.object({
    ...commonFlagsSchema.shape,
    file: z.string().meta({
        alias: 'i',
        description: 'Raw Google Video Intelligence JSON file to normalise',
    }),
    mediaId: z.string().meta({
        alias: 'm',
        description: 'Stable app-level media id recorded on every annotation',
    }),
    provider: z.string().optional().meta({
        description: 'Provider label recorded on the analysis run',
    }),
})

const config: AppConfigIn = {
    description:
        'Normalise Google Video Intelligence output into the annotation-core model.',
    examples: [
        [
            '$0 -i result.json -m my-video --out-dir ./out',
            'Normalise a raw annotation file into ./out',
        ],
    ],
    log_level: 'info',
    name: 'annotation-cli',
    version: '0.0.0',
}

const onSuccess: InitSuccessCallback<typeof optionsSchema> = async (args) => {
    const result = await runNormalize({
        file: args.file,
        mediaId: args.mediaId,
        outDir: args.outDir,
        ...(args.provider === undefined ? {} : { provider: args.provider }),
    })

    console.log(`Normalised ${String(result.annotationCount)} annotations`)
    console.log(`  normalised: ${result.normalizedPath}`)
    console.log(`  raw:        ${result.rawPath}`)
}

/** Parse argv (defaults to `process.argv`), validate against {@link optionsSchema}, and run the normalise command. */
export const main = async (argv?: Array<string>): Promise<void> => {
    await initApp(optionsSchema, config, onSuccess, argv)
}
