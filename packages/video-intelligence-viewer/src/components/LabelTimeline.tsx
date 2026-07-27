/**
 * Label-detection panel: one row per label with its confidence-filtered segments laid out across the video duration,
 * plus a live "current labels" list of everything active at `currentTime`.
 */

import { Box, Chip, Stack, Typography } from '@mui/material'
import { type ReactElement, useMemo } from 'react'
import { type LabelAnnotation } from '../types.ts'
import { timeOffsetToSeconds } from '../utils/time.ts'

export type LabelTimelineProps = {
    /** Current playback time in seconds. */
    currentTime: number
    /** Hide the panel's own heading (e.g. when the title is shown by a surrounding accordion). */
    hideHeading?: boolean
    /** Label annotations (shot- or segment-level). */
    labels: Array<LabelAnnotation>
    /** Seek the video to `seconds` (wired to the segment blocks). */
    onSeek?: (seconds: number) => void
    /** Confidence gate — only segments with `confidence > threshold` are shown. */
    threshold: number
    /** Video duration in seconds (0 falls back to the latest segment end). */
    videoLength: number
}

type ResolvedLabel = { name: string; segments: Array<ResolvedSegment> }
type ResolvedSegment = { confidence: number; end: number; start: number }

const labelName = (label: LabelAnnotation): string => {
    const category = label.category_entities?.[0]?.description
    return category === undefined
        ? label.entity.description
        : `${label.entity.description} (${category})`
}

const LabelTimeline = ({
    currentTime,
    hideHeading = false,
    labels,
    onSeek,
    threshold,
    videoLength,
}: LabelTimelineProps): ReactElement => {
    const resolved = useMemo<Array<ResolvedLabel>>(
        () =>
            labels
                .map((label) => ({
                    name: labelName(label),
                    segments: label.segments
                        .filter(
                            (segment) => (segment.confidence ?? 0) > threshold,
                        )
                        .map((segment) => ({
                            confidence: segment.confidence ?? 0,
                            end: timeOffsetToSeconds(
                                segment.segment?.end_time_offset,
                            ),
                            start: timeOffsetToSeconds(
                                segment.segment?.start_time_offset,
                            ),
                        })),
                }))
                .filter((label) => label.segments.length > 0),
        [labels, threshold],
    )

    const total =
        videoLength > 0
            ? videoLength
            : Math.max(
                  1,
                  ...resolved.flatMap((label) =>
                      label.segments.map((segment) => segment.end),
                  ),
              )

    const current = resolved
        .filter((label) =>
            label.segments.some(
                (segment) =>
                    currentTime >= segment.start && currentTime < segment.end,
            ),
        )
        .map((label) => label.name)

    return (
        <Box>
            {!hideHeading && (
                <Typography gutterBottom variant="subtitle2">
                    Labels ({resolved.length})
                </Typography>
            )}

            <Stack
                direction="row"
                spacing={0.5}
                sx={{ flexWrap: 'wrap', mb: 1 }}>
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

            {resolved.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                    No labels above the confidence threshold.
                </Typography>
            ) : (
                <Stack spacing={0.5}>
                    {resolved.map((label) => (
                        <Stack
                            alignItems="center"
                            direction="row"
                            key={label.name}
                            spacing={1}>
                            <Typography
                                sx={{ flexShrink: 0, width: 140 }}
                                variant="body2">
                                {label.name}
                            </Typography>
                            <Box
                                sx={{
                                    bgcolor: 'action.hover',
                                    borderRadius: 1,
                                    flexGrow: 1,
                                    height: 16,
                                    position: 'relative',
                                }}>
                                {label.segments.map((segment) => {
                                    const active =
                                        currentTime >= segment.start &&
                                        currentTime < segment.end
                                    const leftPct =
                                        (segment.start / total) * 100
                                    const widthPct =
                                        (Math.max(
                                            0,
                                            segment.end - segment.start,
                                        ) /
                                            total) *
                                        100
                                    return (
                                        <Box
                                            key={`${label.name}-${segment.start.toString()}`}
                                            onClick={() =>
                                                onSeek?.(segment.start)
                                            }
                                            sx={{
                                                bgcolor: active
                                                    ? '#4285F4'
                                                    : 'grey.500',
                                                borderRadius: 1,
                                                cursor: 'pointer',
                                                height: '100%',
                                                left: `${leftPct.toString()}%`,
                                                position: 'absolute',
                                                width: `${widthPct.toString()}%`,
                                            }}
                                            title={`confidence ${segment.confidence.toFixed(2)}`}
                                        />
                                    )
                                })}
                            </Box>
                        </Stack>
                    ))}
                </Stack>
            )}
        </Box>
    )
}

export default LabelTimeline
