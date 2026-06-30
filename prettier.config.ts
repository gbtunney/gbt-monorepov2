import { Prettier, type PrettierTool } from '@snailicid3/config'
const config: PrettierTool['config'] = Prettier.defineConfig(
    Prettier.config({ cwd: import.meta }),
)
export default config
