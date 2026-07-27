/**
 * Client-side file loaders: pick a local video (→ object URL) and/or a local annotation JSON (→ parsed
 * {@link VideoAnnotations}). Nothing leaves the browser. Parse errors surface in a MUI `Alert`.
 */

import { Alert, Button, Stack } from '@mui/material'
import { type ChangeEvent, type ReactElement, useState } from 'react'
import { parseAnnotations } from '../parse.ts'
import { type VideoAnnotations } from '../types.ts'

export type FileLoaderProps = {
    /** Called with the parsed annotations after a successful JSON load. */
    onAnnotationsSelected?: (annotations: VideoAnnotations) => void
    /** Called with an object URL after a video file is chosen. */
    onVideoSelected?: (url: string) => void
}

const FileLoader = ({
    onAnnotationsSelected,
    onVideoSelected,
}: FileLoaderProps): ReactElement => {
    const [error, setError] = useState<null | string>(null)

    const handleVideo = (event: ChangeEvent<HTMLInputElement>): void => {
        const file = event.target.files?.[0]
        if (file === undefined) return
        onVideoSelected?.(URL.createObjectURL(file))
    }

    const handleJson = (event: ChangeEvent<HTMLInputElement>): void => {
        const file = event.target.files?.[0]
        if (file === undefined) return
        const reader = new FileReader()
        reader.onload = (): void => {
            const text = typeof reader.result === 'string' ? reader.result : ''
            try {
                onAnnotationsSelected?.(parseAnnotations(text))
                setError(null)
            } catch (parseError) {
                setError(
                    parseError instanceof Error
                        ? parseError.message
                        : String(parseError),
                )
            }
        }
        reader.onerror = (): void => {
            setError('Could not read the file.')
        }
        reader.readAsText(file)
    }

    return (
        <Stack spacing={1}>
            <Stack direction="row" spacing={1}>
                <Button component="label" variant="outlined">
                    Load video
                    <input
                        accept="video/*"
                        hidden
                        onChange={handleVideo}
                        type="file"
                    />
                </Button>
                <Button component="label" variant="outlined">
                    Load annotations (JSON)
                    <input
                        accept="application/json,.json"
                        hidden
                        onChange={handleJson}
                        type="file"
                    />
                </Button>
            </Stack>
            {error !== null && (
                <Alert
                    onClose={() => {
                        setError(null)
                    }}
                    severity="error">
                    {error}
                </Alert>
            )}
        </Stack>
    )
}

export default FileLoader
