import {
    Color4,
    FreeCamera,
    HemisphericLight,
    type Mesh,
    MeshBuilder,
    type Scene,
    Vector3,
} from '@babylonjs/core'
import { isValidColor, parseColorToHexStrict } from '@snailicid3/color'
import SceneComponent from 'babylonjs-hook'
import { type CSSProperties, type ReactElement, useState } from 'react'
import {
    type CameraOrthoConfig,
    type Dimensions,
    setOrthoCamera,
} from '../helpers.ts'
import GbtScopeWallpaperMaterial, {
    defaultGbtScopeWallpaperMaterialProps,
    type GbtScopeWallpaperMaterialProps,
} from './GbtScopeWallpaperMaterial.tsx'

export type GbtScopeWallpaperViewerProps = Omit<
    GbtScopeWallpaperMaterialProps,
    'dimensions'
> & {
    aspect_ratio?: 'parent' | number
    bg_color?: string
    cameraSettings?: CameraOrthoConfig
    name?: string
    resolution?: 'screen' | Dimensions | null
}

export const defaultGbtScopeWallpaperViewerProps = {
    ...defaultGbtScopeWallpaperMaterialProps,
    aspect_ratio: 1 as 'parent' | number,
    bg_color: 'black',
    cameraSettings: {
        enabled: false,
        ortho: true,
        target: [0, 0, 0],
    } as CameraOrthoConfig,
    name: 'gbt-scope-wallpaper',
    resolution: 'screen' as 'screen' | Dimensions | null,
    src: 'uv-checker.png',
} satisfies GbtScopeWallpaperViewerProps

/** Flat Babylon viewer dedicated to the 17 wallpaper-group bitmap transforms. */
const GbtScopeWallpaperViewer = ({
    aspect_ratio = 1,
    bg_color = 'black',
    cameraSettings = defaultGbtScopeWallpaperViewerProps.cameraSettings,
    group = defaultGbtScopeWallpaperMaterialProps.group,
    imageAspect = defaultGbtScopeWallpaperMaterialProps.imageAspect,
    name = 'gbt-scope-wallpaper',
    opacity = defaultGbtScopeWallpaperMaterialProps.opacity,
    postOffset = defaultGbtScopeWallpaperMaterialProps.postOffset,
    postRotation = defaultGbtScopeWallpaperMaterialProps.postRotation,
    postScale = defaultGbtScopeWallpaperMaterialProps.postScale,
    preOffset = defaultGbtScopeWallpaperMaterialProps.preOffset,
    preRotation = defaultGbtScopeWallpaperMaterialProps.preRotation,
    preScale = defaultGbtScopeWallpaperMaterialProps.preScale,
    repeat = defaultGbtScopeWallpaperMaterialProps.repeat,
    resolution = 'screen',
    src,
}: GbtScopeWallpaperViewerProps): ReactElement => {
    const [scene, setScene] = useState<null | Scene>(null)
    const [plane, setPlane] = useState<Mesh | null>(null)

    const customStyle: CSSProperties = {
        backgroundColor: isValidColor(bg_color)
            ? parseColorToHexStrict(bg_color)
            : 'initial',
        ...(aspect_ratio !== 'parent' ? { aspectRatio: aspect_ratio } : {}),
    }

    const dimensions: Dimensions | undefined =
        resolution === 'screen'
            ? scene !== null
                ? {
                      height: scene.getEngine().getRenderHeight(),
                      width: scene.getEngine().getRenderWidth(),
                  }
                : undefined
            : (resolution ?? undefined)

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
    }

    return (
        <div style={customStyle}>
            <SceneComponent
                antialias
                id={`canvas_${name}`}
                onSceneReady={onSceneReady}
                style={{ height: '100%', width: '100%' }}>
                {scene !== null && plane !== null && (
                    <GbtScopeWallpaperMaterial
                        dimensions={dimensions}
                        group={group}
                        imageAspect={imageAspect}
                        mesh={plane}
                        name={`material_${name}`}
                        opacity={opacity}
                        postOffset={postOffset}
                        postRotation={postRotation}
                        postScale={postScale}
                        preOffset={preOffset}
                        preRotation={preRotation}
                        preScale={preScale}
                        repeat={repeat}
                        src={src}
                    />
                )}
            </SceneComponent>
        </div>
    )
}

export default GbtScopeWallpaperViewer
