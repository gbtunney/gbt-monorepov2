/** Public API barrel for `@snailicid3/gbt-scope` */

/** Flat (non-3D) viewer */
export {
    defaultGbtScopeFlatViewerProps,
    default as GbtScopeFlatViewer,
    type GbtScopeFlatViewerProps,
} from './components/GbtScopeFlatViewer.tsx'

/** Core shader material */
export {
    default as GbtScopeMaterial,
    type GbtScopeMaterialComponentProps,
} from './components/GbtScopeMaterial.tsx'

/** 3D mesh viewer */
export {
    defaultGbtScopeMeshViewerProps,
    default as GbtScopeMeshViewer,
    type GbtScopeMeshViewerProps,
} from './components/GbtScopeMeshViewer.tsx'

/** Helpers */
export { type Dimensions, type Point, type XY } from './helpers.ts'

/** Motion: animator system */
export {
    applyAnimators,
    type GbtScopeAnimator,
    type GbtScopeAnimatorSource,
    type GbtScopeAnimatorTarget,
    type GbtScopeInputs,
    type GbtScopeState,
} from './motion/animator.ts'

/** Motion: curve + inputs */
export {
    applyCurve,
    isTupleCurve,
    tupleToGbtScopeCurve,
} from './motion/curve.ts'
export {
    createPointerState,
    type PointerState,
    type PointerStateHandle,
} from './motion/pointer.ts'
export {
    createScrollState,
    type ScrollState,
    type ScrollStateHandle,
} from './motion/scroll.ts'

/** Shared types + material defaults */
export {
    defaultGbtScopeMaterialProps,
    type GbtScopeCurve,
    type GbtScopeMaterialProps,
    type GbtScopeTileMode,
    type GbtScopeViewerBaseProps,
} from './types.ts'
