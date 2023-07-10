import { mkdir } from 'fs/promises'
import { dirname } from 'path'

export function sleep(time = 100) {
    let timeout: any
    return new Promise<void>((resolve) => {
        timeout = setTimeout(() => {
            clearTimeout(timeout)
            resolve()
        }, time)
    })
}

export function ensureFolderExists(filePath: string) {
    const folder = dirname(filePath)
    return mkdir(folder, { recursive: true })
}

export function extractNameFromUrl(fileUrl: string) {
    const url = new URL(fileUrl)
    var filename = url.pathname.substring(url.pathname.lastIndexOf('/') + 1)
    return decodeURI(filename)
}

export function extractFileExtensionFromFileUrl(url: string) {
    const nameFromUrl = extractNameFromUrl(url)

    const fileNameParts = nameFromUrl.split('.')

    if (fileNameParts.length === 1) return ''

    return fileNameParts.slice(-1)[0]
}
