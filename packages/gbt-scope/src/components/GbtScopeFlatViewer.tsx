import {
    Color4,
    FreeCamera,
    HemisphericLight,
    type Mesh,
    MeshBuilder,
    type Scene,
    Vector3,
} from '@babylonjs/core'
import {
    parseColorJS,
    isValidColor,
    parseColorToHexStrict,
} from '@snailicid3/color'
import SceneComponent from 'babylonjs-hook'
import {
    type CSSProperties,
    type ReactElement,
    useEffect,
    useRef,
    useState,
} from 'react'
import GbtScopeMaterial from './GbtScopeMaterial.tsx'
import {
    type CameraOrthoConfig,
    type Dimensions,
    setOrthoCamera,
} from '../helpers.ts'
import { createPointerState } from '../motion/pointer.ts'
import { createScrollState } from '../motion/scroll.ts'
import {
    defaultGbtScopeMaterialProps,
    type GbtScopeMaterialProps,
    type GbtScopeViewerBaseProps,
} from '../types.ts'

export type GbtScopeFlatViewerProps = GbtScopeViewerBaseProps &
    Omit<GbtScopeMaterialProps, 'dimensions'> & {
        name?: string
        cameraSettings?: CameraOrthoConfig
    }

/** Default props for the flat viewer — single source of truth for Storybook args. */
export const defaultGbtScopeFlatViewerProps = {
    ...defaultGbtScopeMaterialProps,
    animators: [],
    aspect_ratio: 1 as number | 'parent',
    bg_color: 'black',
    cameraSettings: {
        enabled: false,
        ortho: true,
        target: [0, 0, 0],
    } as CameraOrthoConfig,
    name: 'gbt-scope-flat',
    resolution: 'screen' as 'screen' | Dimensions | null,
    src: 'uv-checker.png',
} satisfies GbtScopeFlatViewerProps

const GbtScopeFlatViewer = ({
    animators = [],
    aspect_ratio = 1,
    bg_color = 'black',
    cameraSettings = { enabled: false, ortho: true, target: [0, 0, 0] },
    imageAspect = defaultGbtScopeMaterialProps.imageAspect,
    name = 'gbt-scope-flat',
    offset = defaultGbtScopeMaterialProps.offset,
    offsetScale = defaultGbtScopeMaterialProps.offsetScale,
    opacity = defaultGbtScopeMaterialProps.opacity,
    resolution = 'screen',
    rotation = defaultGbtScopeMaterialProps.rotation,
    rotationScale = defaultGbtScopeMaterialProps.rotationScale,
    scaleFactor = defaultGbtScopeMaterialProps.scaleFactor,
    segments = defaultGbtScopeMaterialProps.segments,
    src = 'uv-checker.png',
    tiling = defaultGbtScopeMaterialProps.tiling,
    tileMode = defaultGbtScopeMaterialProps.tileMode,
}: GbtScopeFlatViewerProps): ReactElement => {
    const [scene, setScene] = useState<Scene | null>(null)
    const [plane, setPlane] = useState<Mesh | null>(null)
    const [_dimensions, setDimensions] = useState<Dimensions | undefined>(
        undefined,
    )

    // Stable input handles read by the material's render-loop driver.
    const pointerRef = useRef(createPointerState())
    const scrollRef = useRef(createScrollState())

    const customStyle: CSSProperties = {
        backgroundColor: isValidColor(bg_color)
            ? parseColorToHexStrict(bg_color)
            : 'initial',
        border: '2px solid green',
        ...(aspect_ratio !== 'parent' ? { aspectRatio: aspect_ratio } : {}),
    }

    useEffect(() => {
        if (resolution === 'screen' && scene !== null) {
            setDimensions({
                height: scene.getEngine().getRenderHeight(),
                width: scene.getEngine().getRenderWidth(),
            })
        } else if (
            resolution !== 'screen' &&
            resolution !== undefined &&
            resolution !== null
        ) {
            setDimensions(resolution)
        } else {
            setDimensions(undefined)
        }
    }, [resolution, scene])

    const onSceneReady = (_scene: Scene): void => {
        _scene.clearColor = new Color4(0, 0, 0, 1)
        setScene(_scene)

        const camera = new FreeCamera(
            `camera_${name}`,
            new Vector3(0, 0, -10),
            _scene,
        )
        setOrthoCamera(_scene, camera, cameraSettings)

        new HemisphericLight(`light_${name}`, new Vector3(0, 1, 0), _scene)

        const planeMesh = MeshBuilder.CreatePlane(
            `plane_${name}`,
            {
                height: _scene.getEngine().getRenderHeight(),
                width: _scene.getEngine().getRenderWidth(),
            },
            _scene,
        )
        setPlane(planeMesh)

        const canvas = _scene.getEngine().getRenderingCanvas()
        if (canvas) {
            canvas.tabIndex = 1
            canvas.addEventListener('keydown', (event) => {
                if (event.key === 'Escape')
                    setOrthoCamera(_scene, camera, cameraSettings)
            })
            pointerRef.current.attach(canvas)
            scrollRef.current.attach()
            _scene.onDisposeObservable.add(() => {
                pointerRef.current.detach(canvas)
                scrollRef.current.detach()
            })
        }
    }

    return (
        <div style={customStyle}>
            <SceneComponent
                antialias
                onSceneReady={onSceneReady}
                id="my-canvas"
                style={{ height: '100%', width: '100%' }}>
                {scene && plane && (
                    <GbtScopeMaterial
                        animators={animators}
                        dimensions={_dimensions}
                        imageAspect={imageAspect}
                        mesh={plane}
                        name={`material_${name}`}
                        offset={offset}
                        offsetScale={offsetScale}
                        opacity={opacity}
                        pointer={pointerRef.current}
                        rotation={rotation}
                        rotationScale={rotationScale}
                        scaleFactor={scaleFactor}
                        scroll={scrollRef.current}
                        segments={segments}
                        src={src}
                        tiling={tiling}
                        tileMode={tileMode}
                    />
                )}
            </SceneComponent>
        </div>
    )
}

export default GbtScopeFlatViewer
