import { EsLint } from '@snailicid3/config'
import url from 'node:url'
const cwd = url.fileURLToPath(new URL('.', import.meta.url))
const CONFIG = EsLint.config({ cwd: import.meta })
export default EsLint.defineConfig(CONFIG)
