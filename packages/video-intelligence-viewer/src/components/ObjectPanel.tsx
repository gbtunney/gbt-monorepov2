/**
 * Compact object-tracking panel: the total count above the threshold and a live list of the distinct objects visible at
 * `currentTime` (the boxes themselves are drawn on the canvas overlay). No per-item timeline — there can be hundreds.
 */

import { Box, Chip, Stack, Typography } from '@mui/material'
import { type ReactElement } from 'react'
import { type ObjectTrackingAnnotation } from '../types.ts'
import { withinSegment } from '../utils/range.ts'

export type ObjectPanelProps = {
    /** Current playback time in seconds. */
    currentTime: number
    /** Hide the panel's own heading (e.g. when the title is shown by a surrounding accordion). */
    hideHeading?: boolean
    /** Object-tracking annotations. */
    objectTracks: Array<ObjectTrackingAnnotation>
    /** Confidence gate — only tracks with `confidence > threshold` are counted. */
    threshold: number
}

const ObjectPanel = ({
    currentTime,
    hideHeading = false,
    objectTracks,
    threshold,
}: ObjectPanelProps): ReactElement => {
    const visible = objectTracks.filter(
        (object) => (object.confidence ?? 0) > threshold,
    )
    const current = [
        ...new Set(
            visible
                .filter((object) =>
                    withinSegment(currentTime, object.segment, object.frames),
                )
                .map((object) => object.entity.description),
        ),
    ]

    return (
        <Box>
            {!hideHeading && (
                <Typography gutterBottom variant="subtitle2">
                    Objects ({visible.length})
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
                    current.map((name) => (
                        <Chip key={name} label={name} size="small" />
                    ))
                )}
            </Stack>
        </Box>
    )
}

export default ObjectPanel
