import chalk from 'chalk'
import ora from 'ora'

import { DEFAULT_DELAY_TIME } from '../constants'
import { args } from '../services'

export const delay = (time = 100) => {
    let timeout: any
    return new Promise<void>((resolve) => {
        timeout = setTimeout(() => {
            clearTimeout(timeout)
            resolve()
        }, time)
    })
}

let spinner: ora.Ora
export const stopSpinner = () => {
    if (spinner) {
        spinner.clear()
        spinner.stop()
    }
}

export const clearConsole = async () => {
    const commandArgs = args.parseArgs(process.argv).parseSync()

    if (commandArgs.silent) return

    if (spinner) {
        stopSpinner()
    }

    process.stdout.write('\u033c')
}

export type TShowSpinnerParams = {
    color?: ora.Color
    text?: string
    shouldClear?: boolean
    delayTime?: number
}

export const showSpinner = async (params: TShowSpinnerParams) => {
    const commandArgs = args.parseArgs(process.argv).parseSync()

    if (commandArgs.silent) {
        await clearConsole()
        return
    }

    const {
        shouldClear,
        text = 'Loading...',
        color = 'blue',
        delayTime = DEFAULT_DELAY_TIME,
    } = params

    shouldClear && (await clearConsole())

    if (!spinner) {
        spinner = ora(text).start()
        spinner.color = color
    } else {
        spinner.text = text
        spinner.color = color
        spinner.start()
    }

    await delay(delayTime)
}

export type TShowMessageParams = {
    color?: ora.Color
    text?: string
    delayTime?: number
    clear?: boolean
}

export const showMessage = async (params: TShowMessageParams) => {
    await stopSpinner()

    if (params.clear) {
        await clearConsole()
    }

    const { 
        color = 'blue',
        text = 'Loading...',
        delayTime = DEFAULT_DELAY_TIME,
    } = params

    const foundColor = chalk[color] || chalk.blue

    console.log(foundColor(text))

    await delay(delayTime)
}