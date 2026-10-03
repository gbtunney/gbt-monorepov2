import {
    json,
    runCommand,
    runCliIfEntrypointAsync,
} from '@snailicid3/node-utils'
import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Run Retool utilities using the package's single app configuration. */
export async function main(
    argumentsList: ReadonlyArray<string> = process.argv.slice(2),
): Promise<void> {
    const packageDirectory = fileURLToPath(new URL('.', import.meta.url))
    const manifest = await json.importObject(
        resolve(packageDirectory, 'package.json'),
    )
    const config = manifest?.['config']
    const retool = json.isObject(config) ? config['retool'] : undefined

    if (!json.isObject(retool))
        throw new Error('Missing config.retool in package.json')

    const host = retool['host']
    const appId = retool['appId']
    const directory = retool['directory']

    if (
        typeof host !== 'string' ||
        !host ||
        typeof appId !== 'string' ||
        !appId ||
        typeof directory !== 'string' ||
        !isAbsolute(directory)
    ) {
        throw new Error(
            'config.retool requires host, appId, and an absolute directory',
        )
    }

    const [command, ...extraArguments] = argumentsList
    const organizationCommands: Record<string, ReadonlyArray<string>> = {
        login: ['auth', 'login', '--device', '--host', host],
        logout: ['auth', 'logout', '--host', host],
        status: ['auth', 'status', '--host', host],
        apps: ['apps', '--host', host],
        branches: ['branches', appId, '--host', host],
        clone: ['clone', appId, '--host', host, '--dir', directory],
    }
    const appCommands = new Set([
        'pull',
        'check',
        'start',
        'push',
        'preview',
        'publish',
    ])

    if (command === 'workspace') {
        process.exitCode = runCommand('code', ['--add', directory], {
            stdio: 'inherit',
        }).status
        return
    }

    if (command === 'install') {
        process.exitCode = runCommand(
            'pnpm',
            ['--dir', directory, 'install', ...extraArguments],
            { stdio: 'inherit' },
        ).status
        return
    }

    if (
        !command ||
        (!Object.hasOwn(organizationCommands, command) &&
            !appCommands.has(command))
    ) {
        throw new Error(`Unknown Retool command: ${command ?? '(missing)'}`)
    }

    const organizationArguments = Object.hasOwn(organizationCommands, command)
        ? organizationCommands[command]
        : undefined
    const executable = resolve(packageDirectory, 'node_modules/.bin/retool')
    const result = runCommand(
        executable,
        [...(organizationArguments ?? [command]), ...extraArguments],
        {
            cwd: organizationArguments ? packageDirectory : directory,
            stdio: 'inherit',
        },
    )
    process.exitCode = result.status
}

await runCliIfEntrypointAsync(import.meta, main)
