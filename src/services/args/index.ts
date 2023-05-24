import yargs from 'yargs'

export const parseArgs = (argv: string[]) => {
    return yargs(argv.slice(2)).options({
        debug: {
            type: 'boolean',
            default: false,
            description: 'Print a more detailed output in the console.',
        },
    })
}

export default {
    parseArgs,
}
