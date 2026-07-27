/**
 * Compact text-detection panel: the total count above the threshold and a live list of the strings visible at
 * `currentTime` (the rotated boxes are drawn on the canvas overlay). No per-item timeline — there can be hundreds.
 */

import { Box, Chip, Stack, Typography } from '@mui/material'
import { type ReactElement } from 'react'
import { type TextAnnotation } from '../types.ts'
import { withinSegment } from '../utils/range.ts'

export type TextPanelProps = {
    /** Current playback time in seconds. */
    currentTime: number
    /** Hide the panel's own heading (e.g. when the title is shown by a surrounding accordion). */
    hideHeading?: boolean
    /** Text-detection annotations. */
    textItems: Array<TextAnnotation>
    /** Confidence gate — only segments with `confidence > threshold` count. */
    threshold: number
}

const TextPanel = ({
    currentTime,
    hideHeading = false,
    textItems,
    threshold,
}: TextPanelProps): ReactElement => {
    const visible = textItems.filter((item) =>
        item.segments.some((segment) => (segment.confidence ?? 0) > threshold),
    )
    const current = [
        ...new Set(
            visible
                .filter((item) =>
                    item.segments.some(
                        (segment) =>
                            (segment.confidence ?? 0) > threshold &&
                            withinSegment(
                                currentTime,
                                segment.segment,
                                segment.frames,
                            ),
                    ),
                )
                .map((item) => item.text),
        ),
    ]

    return (
        <Box>
            {!hideHeading && (
                <Typography gutterBottom variant="subtitle2">
                    Text ({visible.length})
                </Typography>
            )}
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                <Typography sx={{ mr: 1 }} variant="body2">
                    Current:
                </Typography>
                {current.length === 0 ? (
                    <Typography color="text.secondary" variant="body2">
                        —
                    </Typography>
                ) : (
                    current.map((text) => (
                        <Chip key={text} label={text} size="small" />
                    ))
                )}
            </Stack>
        </Box>
    )
}

export default TextPanel
