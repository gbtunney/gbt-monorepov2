import { LintStaged, type LintStagedConfig } from '@snailicid3/config'
const config: LintStagedConfig = LintStaged.config({ cwd: import.meta })
export default config
