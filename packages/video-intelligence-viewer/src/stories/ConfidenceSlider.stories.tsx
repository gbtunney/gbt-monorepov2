import type { Meta, StoryObj } from '@storybook/react'
import { type ReactElement, useState } from 'react'
import ConfidenceSlider from '../components/ConfidenceSlider.tsx'
/* eslint perfectionist/sort-objects: "off" */

const meta: Meta<typeof ConfidenceSlider> = {
    component: ConfidenceSlider,
    parameters: { layout: 'padded' },
    tags: ['autodocs'],
    title: 'VideoIntelligence/Components/ConfidenceSlider',
} satisfies Meta<typeof ConfidenceSlider>

export default meta
type Story = StoryObj<typeof meta>

/** Controlled slider — the wrapper holds the value so it actually moves and the readout updates. */
const StatefulSlider = (): ReactElement => {
    const [value, setValue] = useState(0.5)
    return <ConfidenceSlider onChange={setValue} value={value} />
}

export const Default: Story = { render: () => <StatefulSlider /> }
