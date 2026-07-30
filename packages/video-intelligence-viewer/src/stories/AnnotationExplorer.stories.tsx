import { adaptGoogleVideoIntelligence } from '@snailicid3/annotation-adapter-google-vi'
import type { Meta, StoryObj } from '@storybook/react'

import { sampleAnnotations } from './data/sample-annotations.ts'
import AnnotationExplorer from '../components/AnnotationExplorer.tsx'

/** The bundled Google sample, run through the adapter into the provider-neutral annotation-core model. */
const { annotations } = adaptGoogleVideoIntelligence(sampleAnnotations, {
    mediaId: 'sample',
})

const meta = {
    component: AnnotationExplorer,
    parameters: { layout: 'padded' },
    tags: ['autodocs'],
    title: 'VideoIntelligence/AnnotationExplorer',
} satisfies Meta<typeof AnnotationExplorer>

export default meta

type Story = StoryObj<typeof meta>

/**
 * Adapter output over the ~10s sample: drag the in/out slider to narrow the range (badges recount live), raise the
 * confidence floor to drop the low-confidence "sky" label, or type in the search box to match on label text.
 */
export const WithSampleData: Story = {
    args: { annotations, duration: 10 },
}

/** Empty state — the filters render, every kind accordion is gone, and nothing is shown. */
export const Empty: Story = {
    args: { annotations: [] },
}
