#!/usr/bin/env node

import { questions, args } from './src/services'
import { showSpinner, stopSpinner, showMessage } from './src/utils'

;(async () => {
    const commandArgs = args.parseArgs(process.argv).parseSync()

    const answers = await questions.start()

    await showSpinner({ text: 'Starting process ...', color: 'blue' })

    if (commandArgs.debug) {
        await showMessage({
            text: 'Showing a more detailed log',
            color: 'yellow',
        }) 
        await showMessage({
            text: JSON.stringify(answers, null, 2),
            color: 'yellow',
        })
    }

    if (answers.isHappy) {
        await showMessage({
            text: "If you are happy, I'm happy too!",
            color: 'green',
            clear: true,
        })
    } else {
        await showMessage({
            text: "Sorry to hear that!",
            color: 'red',
            clear: true,
        })   
    }

    await showSpinner({ text: 'Finishing process...', color: 'green' })

    stopSpinner()
})()
