/* * JSON TYPES and UTILS * */
import { dateUtils, dayjs, numeric } from '@snailicid3/utils'
export type HelloWorld = number | string
export const helloThere: string = 'i am new'
export const sampleFunc = (value: HelloWorld): HelloWorld => {
    const __firs = dayjs('10-31-2004').isValid()
    /** Tg.isNotNilOrEmpty('') */
    const _result = dateUtils.isValidDate('10-31-2004', 'MM-DD-YYYY')
    const semver = numeric.isNumeric('1')
    console.log('sampleFunc:: ', value, semver, _result, __firs)
    return value
}

sampleFunc('herp derp')
