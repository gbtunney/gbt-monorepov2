import { EsLint } from '@snailicid3/config'

const CONFIG = EsLint.config({
    cwd: import.meta,
    overrides: [{ settings: { 'import-x/ignore': ['node_modules'] } }],
})
export default EsLint.defineConfig(CONFIG)
