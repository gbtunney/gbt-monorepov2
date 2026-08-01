import {
    type ChangeEvent,
    type ReactElement,
    useEffect,
    useRef,
} from 'react'

export type GbtScopeBitmapLoaderProps = {
    accept?: string
    label?: string
    onBitmapSelected: (url: string, file: File) => void
}

/**
 * Loads a local bitmap as an object URL. Nothing leaves the browser. The previous URL is revoked when a replacement is
 * chosen or the component unmounts.
 */
const GbtScopeBitmapLoader = ({
    accept = 'image/*',
    label = 'Load bitmap',
    onBitmapSelected,
}: GbtScopeBitmapLoaderProps): ReactElement => {
    const objectUrlRef = useRef<null | string>(null)

    useEffect(
        () => () => {
            if (objectUrlRef.current !== null)
                URL.revokeObjectURL(objectUrlRef.current)
        },
        [],
    )

    const handleBitmap = (event: ChangeEvent<HTMLInputElement>): void => {
        const file = event.target.files?.[0]
        if (file === undefined) return

        if (objectUrlRef.current !== null)
            URL.revokeObjectURL(objectUrlRef.current)

        const url = URL.createObjectURL(file)
        objectUrlRef.current = url
        onBitmapSelected(url, file)

        // Allow selecting the same file again after it changes on disk.
        event.target.value = ''
    }

    return (
        <label
            style={{
                alignItems: 'center',
                border: '1px solid currentColor',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'inline-flex',
                font: 'inherit',
                gap: 8,
                padding: '8px 12px',
            }}>
            {label}
            <input
                accept={accept}
                hidden
                onChange={handleBitmap}
                type="file"
            />
        </label>
    )
}

export default GbtScopeBitmapLoader
