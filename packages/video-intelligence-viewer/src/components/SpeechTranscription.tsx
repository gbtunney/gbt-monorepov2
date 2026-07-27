/**
 * Speech transcription panel: the transcript rendered word-by-word, with the word spoken at `currentTime` highlighted
 * and every word click-to-seek. Segments are gated by their best-alternative confidence.
 */

import { Box, Stack, Typography } from '@mui/material'
import { type ReactElement } from 'react'
import { type SpeechSegment } from '../select.ts'

export type SpeechTranscriptionProps = {
    /** Current playback time in seconds. */
    currentTime: number
    /** Hide the panel's own heading (e.g. when the title is shown by a surrounding accordion). */
    hideHeading?: boolean
    /** Seek the video to `seconds` (wired to each word). */
    onSeek?: (seconds: number) => void
    /** Transcribed segments (see `selectSpeech`). */
    segments: Array<SpeechSegment>
    /** Confidence gate — only segments with `confidence > threshold` are shown. */
    threshold: number
}

const SpeechTranscription = ({
    currentTime,
    hideHeading = false,
    onSeek,
    segments,
    threshold,
}: SpeechTranscriptionProps): ReactElement => {
    const visible = segments.filter((segment) => segment.confidence > threshold)

    return (
        <Box>
            {!hideHeading && (
                <Typography gutterBottom variant="subtitle2">
                    Speech transcription ({visible.length})
                </Typography>
            )}
            {visible.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                    No transcription above the confidence threshold.
                </Typography>
            ) : (
                <Stack spacing={1}>
                    {visible.map((segment, segmentIndex) => (
                        <Typography
                            key={`${segmentIndex.toString()}-${segment.words[0].start.toString()}`}
                            variant="body2">
                            {segment.words.map((word, wordIndex) => {
                                const active =
                                    currentTime >= word.start &&
                                    currentTime < word.end
                                return (
                                    <Box
                                        component="span"
                                        key={`${wordIndex.toString()}-${word.start.toString()}`}
                                        onClick={() => onSeek?.(word.start)}
                                        sx={{
                                            bgcolor: active
                                                ? '#4285F4'
                                                : 'transparent',
                                            borderRadius: 0.5,
                                            color: active
                                                ? 'common.white'
                                                : 'inherit',
                                            cursor: 'pointer',
                                            px: 0.25,
                                        }}>
                                        {word.text}{' '}
                                    </Box>
                                )
                            })}
                        </Typography>
                    ))}
                </Stack>
            )}
        </Box>
    )
}

export default SpeechTranscription
