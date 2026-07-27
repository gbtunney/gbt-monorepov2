/** A single shared confidence-threshold slider (0–1). One gate for every feature panel in this first pass. */

import { Box, Slider, Typography } from '@mui/material'
import { type ReactElement } from 'react'

export type ConfidenceSliderProps = {
    /** Called with the new threshold as the slider moves. */
    onChange: (value: number) => void
    /** Current threshold (0–1). */
    value: number
}

const ConfidenceSlider = ({
    onChange,
    value,
}: ConfidenceSliderProps): ReactElement => (
    <Box sx={{ maxWidth: 320 }}>
        <Typography gutterBottom variant="body2">
            Confidence threshold: {value.toFixed(2)}
        </Typography>
        <Slider
            aria-label="Confidence threshold"
            max={1}
            min={0}
            onChange={(_event, next) => {
                onChange(typeof next === 'number' ? next : next[0])
            }}
            step={0.01}
            value={value}
            valueLabelDisplay="auto"
        />
    </Box>
)

export default ConfidenceSlider
