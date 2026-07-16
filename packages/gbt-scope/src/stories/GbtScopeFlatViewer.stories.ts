import type { Meta, StoryObj } from '@storybook/react'
import { argTypes, flatDefaultArgs } from './GbtScopeShared.ts'
import GbtScopeFlatViewer from '../components/GbtScopeFlatViewer.tsx'
import type { GbtScopeAnimator } from '../motion/animator.ts'
/* eslint  perfectionist/sort-objects: "off" */

const meta: Meta<typeof GbtScopeFlatViewer> = {
    args: { ...flatDefaultArgs },
    argTypes,
    component: GbtScopeFlatViewer,
    parameters: { layout: 'centered' },
    tags: ['autodocs'],
    title: 'GbtScope/Flat Viewer',
} satisfies Meta<typeof GbtScopeFlatViewer>

export default meta

type FlatStory = StoryObj<typeof meta>

const driftAnimators: Array<GbtScopeAnimator> = [
    { mode: 'add', source: 'time', speed: 0.3, target: 'rotation' },
]

const mouseAnimators: Array<GbtScopeAnimator> = [
    { mode: 'add', source: 'time', speed: 0.1, target: 'rotation' },
    {
        curve: { exponent: 1.4, max: 1, multiplier: 0.6 },
        mode: 'add',
        source: 'mouseDistance',
        speed: 2,
        target: 'rotation',
    },
]

const scrollAnimators: Array<GbtScopeAnimator> = [
    {
        curve: { max: 0.3, multiplier: 0.2 },
        mode: 'add',
        source: 'scrollVelocity',
        speed: 1,
        target: 'offset.x',
    },
]

/** Static kaleidoscope — no animators; every prop adjustable in Controls. */
export const STATIC: FlatStory = {
    name: 'Static',
    args: { ...flatDefaultArgs, animators: [] },
}

/** Constant, frame-rate-independent rotation drift (time → rotation). */
export const slowDrift: FlatStory = {
    args: { ...flatDefaultArgs, animators: driftAnimators },
}

/** Rotation speeds up as the pointer nears the canvas edges. */
export const mouseReactive: FlatStory = {
    args: { ...flatDefaultArgs, animators: mouseAnimators },
}

/** Horizontal offset driven by scroll-wheel velocity. */
export const scrollReactive: FlatStory = {
    args: {
        ...flatDefaultArgs,
        animators: scrollAnimators,
        tileMode: 'mirror',
    },
}
