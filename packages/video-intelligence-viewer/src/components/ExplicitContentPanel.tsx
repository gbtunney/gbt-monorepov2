/**
 * Explicit-content panel: a timeline bar whose segments are colored by the per-frame pornography-likelihood rating
 * (green = very unlikely → red = very likely), plus the rating in effect at `currentTime`. Categorical, so no
 * interpolation and no confidence gate. Click a segment to seek.
 */

import { Box, Chip, Stack, Typography } from '@mui/material'
import { type ReactElement } from 'react'
import { type ExplicitFrameTiming } from '../select.ts'
import { likelihoodColor } from '../utils/likelihood.ts'

export type ExplicitContentPanelProps = {
    /** Current playback time in seconds. */
    currentTime: number
    /** Explicit-content frames, sorted ascending by time (see `selectExplicitFrames`). */
    frames: Array<ExplicitFrameTiming>
    /** Seek the video to `seconds` (wired to the segments). */
    onSeek?: (seconds: number) => void
    /** Video duration in seconds (0 falls back to the last frame's time). */
    videoLength: number
}

const prettyLikelihood = (value: string): string =>
    value.replace('LIKELIHOOD_UNSPECIFIED', 'UNKNOWN').replace(/_/g, ' ')

const ExplicitContentPanel = ({
    currentTime,
    frames,
    onSeek,
    videoLength,
}: ExplicitContentPanelProps): ReactElement => {
    const total =
        videoLength > 0
            ? videoLength
            : Math.max(1, ...frames.map((frame) => frame.time))

    // Step lookup: the most recent frame at or before the current time.
    let current: null | string = null
    for (const frame of frames) {
        if (frame.time > currentTime) break
        current = frame.likelihood
    }

    return (
        <Box>
            <Typography gutterBottom variant="subtitle2">
                Explicit content ({frames.length})
            </Typography>

            <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', mb: 1 }}>
                <Typography variant="body2">Current:</Typography>
                {current === null ? (
                    <Typography color="text.secondary" variant="body2">
                        —
                    </Typography>
                ) : (
                    <Chip
                        label={prettyLikelihood(current)}
                        size="small"
                        sx={{
                            bgcolor: likelihoodColor(current),
                            color: 'common.white',
                        }}
                    />
                )}
            </Stack>

            {frames.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                    No explicit-content annotation.
                </Typography>
            ) : (
                <Box
                    sx={{
                        borderRadius: 1,
                        display: 'flex',
                        height: 16,
                        overflow: 'hidden',
                        width: '100%',
                    }}>
                    {frames.map((frame, index) => {
                        const end = frames[index + 1]?.time ?? total
                        return (
                            <Box
                                key={`${frame.time.toString()}-${index.toString()}`}
                                onClick={() => onSeek?.(frame.time)}
                                sx={{
                                    bgcolor: likelihoodColor(frame.likelihood),
                                    cursor: 'pointer',
                                    flexBasis: 0,
                                    flexGrow:
                                        Math.max(0, end - frame.time) / total,
                                    minWidth: 1,
                                }}
                                title={`${prettyLikelihood(frame.likelihood)} @ ${frame.time.toFixed(1)}s`}
                            />
                        )
                    })}
                </Box>
            )}
        </Box>
    )
}

export default ExplicitContentPanel
