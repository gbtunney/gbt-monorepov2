/** Shot-change timeline: proportional blocks across the video duration, highlighting the shot at `currentTime`. */

import { Box, Typography } from '@mui/material'
import { type ReactElement } from 'react'
import { type ShotAnnotation } from '../types.ts'
import { timeOffsetToSeconds } from '../utils/time.ts'

export type ShotTimelineProps = {
    /** Current playback time in seconds. */
    currentTime: number
    /** Hide the panel's own heading (e.g. when the title is shown by a surrounding accordion). */
    hideHeading?: boolean
    /** Seek the video to `seconds` (wired to the shot blocks). */
    onSeek?: (seconds: number) => void
    /** Detected shots. */
    shots: Array<ShotAnnotation>
    /** Video duration in seconds (0 falls back to the last shot's end). */
    videoLength: number
}

const formatSeconds = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString()}:${secs.toString().padStart(2, '0')}`
}

const ShotTimeline = ({
    currentTime,
    hideHeading = false,
    onSeek,
    shots,
    videoLength,
}: ShotTimelineProps): ReactElement => {
    const ranges = shots.map((shot) => ({
        end: timeOffsetToSeconds(shot.end_time_offset),
        start: timeOffsetToSeconds(shot.start_time_offset),
    }))
    const total =
        videoLength > 0
            ? videoLength
            : Math.max(1, ...ranges.map((range) => range.end))

    return (
        <Box>
            {!hideHeading && (
                <Typography gutterBottom variant="subtitle2">
                    Shots ({shots.length})
                </Typography>
            )}
            {shots.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                    No shot annotations.
                </Typography>
            ) : (
                <Box
                    sx={{
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        display: 'flex',
                        height: 28,
                        overflow: 'hidden',
                        width: '100%',
                    }}>
                    {ranges.map((range) => {
                        const active =
                            currentTime >= range.start &&
                            currentTime < range.end
                        return (
                            <Box
                                key={`${range.start.toString()}-${range.end.toString()}`}
                                onClick={() => onSeek?.(range.start)}
                                sx={{
                                    bgcolor: active ? '#4285F4' : 'grey.400',
                                    borderRight: '1px solid white',
                                    cursor: 'pointer',
                                    flexBasis: 0,
                                    flexGrow: (range.end - range.start) / total,
                                    minWidth: 2,
                                }}
                                title={`${formatSeconds(range.start)} – ${formatSeconds(range.end)}`}
                            />
                        )
                    })}
                </Box>
            )}
        </Box>
    )
}

export default ShotTimeline
