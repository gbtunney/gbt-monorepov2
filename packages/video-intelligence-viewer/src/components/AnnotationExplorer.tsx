/**
 * A provider-neutral, filterable view over a flat list of `@snailicid3/annotation-core` annotations.
 *
 * This is the "standardised filter" panel: an in/out range slider, a confidence range slider, and a text search feed
 * one `queryAnnotations` call; the surviving annotations are grouped by kind into accordions, each badged with its
 * count _in the current range_ (counted before any kind is hidden, so an empty kind still shows "0"). Every row is a
 * table entry — in / out / duration / confidence — and clicking one seeks the playhead.
 *
 * It reads the normalised model, so it works for any provider the adapters support, not just Google Video Intelligence.
 */

import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Badge,
    Box,
    Slider,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material'
import {
    type Annotation,
    queryAnnotations,
    temporalDuration,
    temporalEnd,
    temporalStart,
} from '@snailicid3/annotation-core'
import { type ReactElement, useMemo, useState } from 'react'

export type AnnotationExplorerProps = {
    /** The normalised annotations to explore (e.g. from an adapter's output). */
    annotations: Array<Annotation>
    /** Media duration in seconds; when omitted, the latest annotation end is used for the range slider. */
    duration?: number
    /** Seek the player to `seconds` — wired to row clicks. */
    onSeek?: (seconds: number) => void
}

const formatSeconds = (seconds: number): string => {
    if (!Number.isFinite(seconds)) return '—'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString()}:${secs.toString().padStart(2, '0')}`
}

const formatConfidence = (confidence: number | undefined): string =>
    confidence === undefined ? '—' : `${(confidence * 100).toFixed(0)}%`

const formatPercent = (value: number): string => `${(value * 100).toFixed(0)}%`

const AnnotationExplorer = ({
    annotations,
    duration,
    onSeek,
}: AnnotationExplorerProps): ReactElement => {
    const maxTime = useMemo(() => {
        if (duration !== undefined && duration > 0) return Math.ceil(duration)
        const ends = annotations
            .map((annotation) => temporalEnd(annotation.temporal, duration))
            .filter((end) => Number.isFinite(end))
        return ends.length > 0 ? Math.ceil(Math.max(...ends)) : 0
    }, [annotations, duration])

    const [range, setRange] = useState<[number, number]>([0, maxTime])
    const [confidence, setConfidence] = useState<[number, number]>([0, 1])
    const [text, setText] = useState('')

    // Reset the in/out selection when the media length changes — React's "adjust state during render" pattern (guarded
    // so it runs once per change), which avoids a setState-in-effect cascade.
    const [knownMax, setKnownMax] = useState(maxTime)
    if (knownMax !== maxTime) {
        setKnownMax(maxTime)
        setRange([0, maxTime])
    }

    const { counts, items } = useMemo(
        () =>
            queryAnnotations(annotations, {
                confidenceMax: confidence[1],
                confidenceMin: confidence[0],
                range,
                text,
            }),
        [annotations, confidence, range, text],
    )

    const byKind = useMemo(() => {
        const groups = new Map<string, Array<Annotation>>()
        for (const item of items) {
            const list = groups.get(item.kind) ?? []
            list.push(item)
            groups.set(item.kind, list)
        }
        return groups
    }, [items])

    // All kinds ever present, so an accordion (badged "0") persists when a filter empties it.
    const kinds = useMemo(
        () =>
            [
                ...new Set(annotations.map((annotation) => annotation.kind)),
            ].toSorted(),
        [annotations],
    )

    return (
        <Box sx={{ maxWidth: 720 }}>
            <Typography gutterBottom variant="h6">
                Annotations
            </Typography>

            <Box sx={{ display: 'grid', gap: 3, mb: 2 }}>
                <Box>
                    <Typography gutterBottom variant="caption">
                        In / out ({formatSeconds(range[0])} –{' '}
                        {formatSeconds(range[1])})
                    </Typography>
                    <Slider
                        disabled={maxTime === 0}
                        max={maxTime}
                        min={0}
                        onChange={(_event, value) => {
                            setRange(value as [number, number])
                        }}
                        value={range}
                        valueLabelDisplay="auto"
                        valueLabelFormat={formatSeconds}
                    />
                </Box>

                <Box>
                    <Typography gutterBottom variant="caption">
                        Confidence ({formatPercent(confidence[0])} –{' '}
                        {formatPercent(confidence[1])})
                    </Typography>
                    <Slider
                        max={1}
                        min={0}
                        onChange={(_event, value) => {
                            setConfidence(value as [number, number])
                        }}
                        step={0.01}
                        value={confidence}
                        valueLabelDisplay="auto"
                        valueLabelFormat={formatPercent}
                    />
                </Box>

                <TextField
                    label="Search labels"
                    onChange={(event) => {
                        setText(event.target.value)
                    }}
                    size="small"
                    value={text}
                />
            </Box>

            <Typography color="text.secondary" gutterBottom variant="body2">
                {items.length.toString()} shown
            </Typography>

            {kinds.map((kind: string) => {
                const rows = byKind.get(kind) ?? []
                return (
                    <Accordion defaultExpanded={rows.length > 0} key={kind}>
                        <AccordionSummary
                            expandIcon={
                                <Box component="span" sx={{ fontSize: 18 }}>
                                    ⌄
                                </Box>
                            }>
                            <Badge
                                badgeContent={counts[kind] ?? 0}
                                color="primary"
                                showZero
                                sx={{ pr: 2 }}>
                                <Typography
                                    sx={{ textTransform: 'capitalize' }}>
                                    {kind}
                                </Typography>
                            </Badge>
                        </AccordionSummary>
                        <AccordionDetails sx={{ p: 0 }}>
                            {rows.length === 0 ? (
                                <Typography
                                    color="text.secondary"
                                    sx={{ p: 2 }}
                                    variant="body2">
                                    Nothing in the current range.
                                </Typography>
                            ) : (
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Label</TableCell>
                                            <TableCell align="right">
                                                In
                                            </TableCell>
                                            <TableCell align="right">
                                                Out
                                            </TableCell>
                                            <TableCell align="right">
                                                Dur
                                            </TableCell>
                                            <TableCell align="right">
                                                Conf
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {rows.map((row) => {
                                            const start = temporalStart(
                                                row.temporal,
                                            )
                                            return (
                                                <TableRow
                                                    hover
                                                    key={row.id}
                                                    onClick={() => {
                                                        onSeek?.(start)
                                                    }}
                                                    sx={{ cursor: 'pointer' }}>
                                                    <TableCell>
                                                        {row.label}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {formatSeconds(start)}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {formatSeconds(
                                                            temporalEnd(
                                                                row.temporal,
                                                                maxTime,
                                                            ),
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {formatSeconds(
                                                            temporalDuration(
                                                                row.temporal,
                                                                maxTime,
                                                            ),
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {formatConfidence(
                                                            row.confidence,
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </AccordionDetails>
                    </Accordion>
                )
            })}
        </Box>
    )
}

export default AnnotationExplorer
