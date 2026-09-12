import type { Meta, StoryObj } from '@storybook/react'
import { createElement, type ReactElement, useState } from 'react'
import GbtScopeBitmapLoader from '../components/GbtScopeBitmapLoader.tsx'
import GbtScopeWallpaperViewer, {
    defaultGbtScopeWallpaperViewerProps,
    type GbtScopeWallpaperViewerProps,
} from '../components/GbtScopeWallpaperViewer.tsx'
import { wallpaperGroups } from '../wallpaper/groups.ts'
/* eslint perfectionist/sort-objects: "off" */

const meta = {
    args: { ...defaultGbtScopeWallpaperViewerProps },
    argTypes: {
        aspect_ratio: {
            control: { type: 'select' },
            options: [1, 1.5, 1.7777778],
            table: { category: 'Viewer' },
        },
        bg_color: {
            control: 'color',
            table: { category: 'Viewer' },
        },
        group: {
            control: { type: 'select' },
            options: wallpaperGroups,
            table: { category: 'Wallpaper Group' },
        },
        imageAspect: {
            control: { min: 0.01, step: 0.01, type: 'number' },
            table: { category: 'Bitmap' },
        },
        opacity: {
            control: { max: 1, min: 0, step: 0.01, type: 'range' },
            table: { category: 'Bitmap' },
        },
        postOffset: {
            control: { type: 'object' },
            table: { category: 'Post Transform' },
        },
        postRotation: {
            control: { step: 0.01, type: 'number' },
            table: { category: 'Post Transform' },
        },
        postScale: {
            control: { type: 'object' },
            table: { category: 'Post Transform' },
        },
        preOffset: {
            control: { type: 'object' },
            table: { category: 'Pre Transform' },
        },
        preRotation: {
            control: { step: 0.01, type: 'number' },
            table: { category: 'Pre Transform' },
        },
        preScale: {
            control: { type: 'object' },
            table: { category: 'Pre Transform' },
        },
        repeat: {
            control: { type: 'object' },
            table: { category: 'Wallpaper Group' },
        },
        resolution: {
            control: { type: 'object' },
            table: { category: 'Viewer' },
        },
        src: {
            control: { type: 'select' },
            options: ['uv-checker.png', 'gradient4-3.png', 'eel.jpg'],
            table: { category: 'Bitmap' },
        },
    },
    component: GbtScopeWallpaperViewer,
    parameters: { layout: 'centered' },
    tags: ['autodocs'],
    title: 'GbtScope/Wallpaper Groups',
} satisfies Meta<typeof GbtScopeWallpaperViewer>

export default meta

type Story = StoryObj<typeof meta>

const groupStory = (
    group: GbtScopeWallpaperViewerProps['group'],
): Story => ({
    args: { ...defaultGbtScopeWallpaperViewerProps, group },
})

export const P1: Story = groupStory('p1')
export const P2: Story = groupStory('p2')
export const Pm: Story = groupStory('pm')
export const Pg: Story = groupStory('pg')
export const Cm: Story = groupStory('cm')
export const Pmm: Story = groupStory('pmm')
export const Pmg: Story = groupStory('pmg')
export const Pgg: Story = groupStory('pgg')
export const Cmm: Story = groupStory('cmm')
export const P4: Story = groupStory('p4')
export const P4m: Story = groupStory('p4m')
export const P4g: Story = groupStory('p4g')
export const P3: Story = groupStory('p3')
export const P3m1: Story = groupStory('p3m1')
export const P31m: Story = groupStory('p31m')
export const P6: Story = groupStory('p6')
export const P6m: Story = groupStory('p6m')

const BitmapUploadDemo = (
    args: GbtScopeWallpaperViewerProps,
): ReactElement => {
    const [src, setSrc] = useState(args.src)

    return createElement(
        'div',
        {
            style: {
                display: 'grid',
                gap: 12,
                minWidth: 480,
            },
        },
        createElement(GbtScopeBitmapLoader, {
            onBitmapSelected: (url: string) => {
                setSrc(url)
            },
        }),
        createElement(GbtScopeWallpaperViewer, { ...args, src }),
    )
}

/** Load any local bitmap with the same object-URL approach used elsewhere in the monorepo. */
export const BitmapUpload: Story = {
    args: { ...defaultGbtScopeWallpaperViewerProps, group: 'p4m' },
    parameters: { chromatic: { disableSnapshot: true } },
    render: (args): ReactElement => createElement(BitmapUploadDemo, args),
}
