import {
    ArcRotateCamera,
    Color4,
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
    type CameraConfigPosition,
    type Dimensions,
    setRotateCameraPosition,
} from '../helpers.ts'
import { createPointerState } from '../motion/pointer.ts'
import { createScrollState } from '../motion/scroll.ts'
import {
    defaultGbtScopeMaterialProps,
    type GbtScopeMaterialProps,
    type GbtScopeViewerBaseProps,
} from '../types.ts'

export type GbtScopeMeshViewerProps = GbtScopeViewerBaseProps &
    Omit<GbtScopeMaterialProps, 'dimensions'> & {
        name?: string
        cameraSettings?: CameraConfigPosition
    }

/** Default props for the 3D mesh viewer — single source of truth for Storybook args. */
export const defaultGbtScopeMeshViewerProps = {
    ...defaultGbtScopeMaterialProps,
    animators: [],
    aspect_ratio: 1 as number | 'parent',
    bg_color: 'black',
    cameraSettings: {
        enabled: true,
        hRotation: Math.PI / 2,
        vRotation: Math.PI / 4,
    } as CameraConfigPosition,
    name: 'gbt-scope-mesh',
    resolution: null as 'screen' | Dimensions | null,
    src: 'uv-checker.png',
} satisfies GbtScopeMeshViewerProps

const GbtScopeMeshViewer = ({
    animators = [],
    aspect_ratio = 1,
    bg_color = 'black',
    cameraSettings = {
        enabled: true,
        hRotation: Math.PI / 2,
        vRotation: Math.PI / 4,
    },
    imageAspect = defaultGbtScopeMaterialProps.imageAspect,
    name = 'gbt-scope-mesh',
    offset = defaultGbtScopeMaterialProps.offset,
    offsetScale = defaultGbtScopeMaterialProps.offsetScale,
    opacity = defaultGbtScopeMaterialProps.opacity,
    resolution = null,
    rotation = defaultGbtScopeMaterialProps.rotation,
    rotationScale = defaultGbtScopeMaterialProps.rotationScale,
    scaleFactor = defaultGbtScopeMaterialProps.scaleFactor,
    segments = defaultGbtScopeMaterialProps.segments,
    src = 'uv-checker.png',
    tiling = defaultGbtScopeMaterialProps.tiling,
    tileMode = defaultGbtScopeMaterialProps.tileMode,
}: GbtScopeMeshViewerProps): ReactElement => {
    const [scene, setScene] = useState<Scene | null>(null)
    const [box, setBox] = useState<Mesh | null>(null)
    const [_dimensions, setDimensions] = useState<Dimensions | undefined>(
        undefined,
    )

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
        _scene.clearColor = new Color4(0, 0, 0, 0)
        setScene(_scene)

        const camera = new ArcRotateCamera(
            `camera_${name}`,
            cameraSettings.hRotation ?? Math.PI / 2,
            cameraSettings.vRotation ?? Math.PI / 4,
            10,
            Vector3.Zero(),
            _scene,
        )
        setRotateCameraPosition(camera, _scene, cameraSettings)

        new HemisphericLight(`light_${name}`, new Vector3(0, 1, 0), _scene)

        const boxMesh = MeshBuilder.CreateBox(
            `box_${name}`,
            { size: 2 },
            _scene,
        )
        boxMesh.position.y = 1
        setBox(boxMesh)

        const canvas = _scene.getEngine().getRenderingCanvas()
        if (canvas) {
            canvas.tabIndex = 1
            canvas.addEventListener('keydown', (event) => {
                if (event.key === 'Escape')
                    setRotateCameraPosition(camera, _scene, cameraSettings)
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
                {scene && box && (
                    <GbtScopeMaterial
                        animators={animators}
                        dimensions={_dimensions}
                        imageAspect={imageAspect}
                        mesh={box}
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

export default GbtScopeMeshViewer
