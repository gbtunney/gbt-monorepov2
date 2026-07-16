/** Public API barrel for @snailicid3/gbt-scope */

// Core shader material
export {
    default as GbtScopeMaterial,
    type GbtScopeMaterialComponentProps,
} from './components/GbtScopeMaterial.tsx'

// Flat (non-3D) viewer
export {
    default as GbtScopeFlatViewer,
    defaultGbtScopeFlatViewerProps,
    type GbtScopeFlatViewerProps,
} from './components/GbtScopeFlatViewer.tsx'

// 3D mesh viewer
export {
    default as GbtScopeMeshViewer,
    defaultGbtScopeMeshViewerProps,
    type GbtScopeMeshViewerProps,
} from './components/GbtScopeMeshViewer.tsx'

// Shared types + material defaults
export {
    type GbtScopeCurve,
    type GbtScopeMaterialProps,
    type GbtScopeTileMode,
    type GbtScopeViewerBaseProps,
    defaultGbtScopeMaterialProps,
} from './types.ts'

// Motion: animator system
export {
    applyAnimators,
    type GbtScopeAnimator,
    type GbtScopeAnimatorSource,
    type GbtScopeAnimatorTarget,
    type GbtScopeInputs,
    type GbtScopeState,
} from './motion/animator.ts'

// Motion: curve + inputs
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

// Helpers
export { type Dimensions, type Point, type XY } from './helpers.ts'
