import * as inquirer from 'inquirer'

export type TQuestions = {
    isHappy: boolean,
}

export const start = async () => {
    return await inquirer.prompt<TQuestions>([
        {
            type: 'confirm',
            message: 'Are you happy?',
            name: 'isHappy',
            default: true,
        },
    ])
}

export default { start }
