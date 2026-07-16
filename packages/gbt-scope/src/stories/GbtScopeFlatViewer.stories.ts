import type { Meta, StoryObj } from '@storybook/react'
import GbtScopeFlatViewer from '../components/GbtScopeFlatViewer.tsx'
import type { GbtScopeAnimator } from '../motion/animator.ts'
import { argTypes, flatDefaultArgs } from './GbtScopeShared.ts'
/* eslint  sort/object-properties: "off" */

const meta: Meta<typeof GbtScopeFlatViewer> = {
    argTypes,
    component: GbtScopeFlatViewer,
    parameters: { layout: 'centered' },
    args: { ...flatDefaultArgs },
    tags: ['autodocs'],
    title: 'GbtScope/Flat Viewer',
} satisfies Meta<typeof GbtScopeFlatViewer>

export default meta

type FlatStory = StoryObj<typeof meta>

const driftAnimators: GbtScopeAnimator[] = [
    { target: 'rotation', source: 'time', mode: 'add', speed: 0.3 },
]

const mouseAnimators: GbtScopeAnimator[] = [
    { target: 'rotation', source: 'time', mode: 'add', speed: 0.1 },
    {
        target: 'rotation',
        source: 'mouseDistance',
        mode: 'add',
        speed: 2,
        curve: { multiplier: 0.6, max: 1, exponent: 1.4 },
    },
]

const scrollAnimators: GbtScopeAnimator[] = [
    {
        target: 'offset.x',
        source: 'scrollVelocity',
        mode: 'add',
        speed: 1,
        curve: { multiplier: 0.2, max: 0.3 },
    },
]

/** Static kaleidoscope — no animators; every prop adjustable in Controls. */
export const Static: FlatStory = {
    args: { ...flatDefaultArgs, animators: [] },
}

/** Constant, frame-rate-independent rotation drift (time → rotation). */
export const SlowDrift: FlatStory = {
    args: { ...flatDefaultArgs, animators: driftAnimators },
}

/** Rotation speeds up as the pointer nears the canvas edges. */
export const MouseReactive: FlatStory = {
    args: { ...flatDefaultArgs, animators: mouseAnimators },
}

/** Horizontal offset driven by scroll-wheel velocity. */
export const ScrollReactive: FlatStory = {
    args: {
        ...flatDefaultArgs,
        tileMode: 'mirror',
        animators: scrollAnimators,
    },
}
