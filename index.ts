import { glob } from 'fast-glob'
import fetch from 'node-fetch'
import fs from 'node:fs'
import path from 'node:path'
import PQueue from 'p-queue'

import { MOISES_API_BASE_URL } from './src/constants/index.js'
import {
    sleep,
    extractFileExtensionFromFileUrl,
    ensureFolderExists,
} from './src/utils/index.js'

export type ProccessStatus =
    | 'PENDING'
    | 'PROCESSING'
    | 'SUCCEEDED'
    | 'FAILED'
    | 'ABORTED'

export type ProcessFolderOptions = {
    apiKey: string
    workflowId: string
    inputFolder: string
    outputFolder: string
    maxConcurrencyNumber?: number
    abortSignal?: AbortSignal
    jobMonitorInterval?: number
    onProgress?: (
        file: string,
        status: JobStatus | ProccessStatus,
        report: any
    ) => Promise<void>
    onLog?(message: string): void
    onError?(message: string): void
}

export type ProcessFileOptions = {
    apiKey: string
    workflowId: string
    filePath: string
    outputFolder: string
    jobMonitorInterval?: number
}

export type JobStatus =
    | 'SUCCEEDED'
    | 'FAILED'
    | 'PENDING'
    | 'PROCESSING'
    | 'DELETED'
    | 'QUEUED'
    | 'CANCELLED'
    | 'STARTED'

type JobData = {
    id: string
    name: string
    status: JobStatus
    workflow: string
    params: {
        inputUrl: string
    }
    result: {
        [key: string]: string
        outputUrl: string
    }
}

type APICallResponse = {
    uploadUrl: string
    downloadUrl: string
    id: string
} & JobData

interface Report {
    [key: string]: {
        status: JobStatus
    }
}

type ReportBreakdown = {
    PENDING: string[]
    PROCESSING: string[]
    SUCCEEDED: string[]
    DELETED: string[]
    QUEUED: string[]
    CANCELLED: string[]
    FAILED: string[]
    STARTED: string[]
}

type DownloadResult = {
    [key: string]: string
}

type ApiCallOptions = {
    method: string
    path: string
    data?: any
    apiKey: string
}

async function apiCall({ method, path, data = {}, apiKey }: ApiCallOptions) {
    const url = `${MOISES_API_BASE_URL}${path}`

    const headers = {
        'Content-Type': 'application/json',
        Authorization: apiKey,
    }

    const response = await fetch(url, {
        method,
        headers,
        body: method === 'GET' ? undefined : JSON.stringify(data),
    })

    if (response.status !== 200) {
        throw new Error(response.statusText)
    }

    const json = await response.json()
    return json as APICallResponse
}

async function uploadFile(fileLocation: string, apiKey: string) {
    console.log(`Uploading file ${fileLocation} ...`)

    const { uploadUrl, downloadUrl } = await apiCall({
        method: 'GET',
        path: '/api/upload',
        apiKey,
    })

    await fetch(uploadUrl, {
        method: 'PUT',
        body: fs.createReadStream(fileLocation),
    })

    return downloadUrl
}

async function downloadFile(url: string, fileDestination: string) {
    console.log(`Downloading file ${url} ...`)

    await ensureFolderExists(fileDestination)

    const response = await fetch(url)
    const buffer = Buffer.from(await response.arrayBuffer())
    await fs.promises.writeFile(fileDestination, buffer)
}

async function addJob(
    name: string,
    workflowId: string,
    params = {},
    apiKey: string
) {
    const { id } = await apiCall({
        method: 'POST',
        path: '/api/job',
        data: {
            name,
            workflow: workflowId,
            params,
        },
        apiKey,
    })
    return id
}

async function processFile({
    apiKey,
    workflowId,
    filePath,
    outputFolder,
    jobMonitorInterval,
}: ProcessFileOptions) {
    if (!apiKey) throw new Error('API Key is required')

    console.log(`Processing file: ${filePath} ...`)

    const name = path.basename(filePath).split('.').shift() ?? 'output'
    const inputUrl = await uploadFile(filePath, apiKey)
    const jobId = await addJob(name, workflowId, { inputUrl }, apiKey)
    const jobData = await waitForJobCompletion(
        apiKey,
        jobId,
        jobMonitorInterval
    )
    const result = await downloadJobResults(apiKey, jobData, outputFolder)

    await deleteJob(apiKey, jobId)

    return result
}

function processFolder({
    apiKey,
    workflowId,
    inputFolder,
    outputFolder,
    maxConcurrencyNumber = 5,
    abortSignal,
    jobMonitorInterval,
    onProgress,
    onLog,
    onError,
}: ProcessFolderOptions): Promise<DownloadResult[]> {
    const results: DownloadResult[] = []

    if (onLog) console.log = onLog
    if (onError) console.error = onError

    // This is needed because glob doesn't work with Windows paths
    if (process.platform === 'win32') {
        inputFolder = inputFolder.replace(/\\/g, '/')
        outputFolder = outputFolder.replace(/\\/g, '/')
    }

    return new Promise(async (resolve) => {
        console.log(`Processing folder: ${inputFolder} -> ${outputFolder} ...`)

        const queue = new PQueue({ concurrency: maxConcurrencyNumber })
        const report: Report = {}

        if (abortSignal) {
            abortSignal.addEventListener('abort', async () => {
                queue.clear()
                await queue.onIdle()

                console.log(`Queue aborted`)

                resolve(results)
            })
        }

        async function queueListener(file: string) {
            try {
                await reportProgress(file, 'PROCESSING')
                const fileName = path.basename(file).split('.').shift()
                await processFile({
                    apiKey,
                    workflowId: workflowId,
                    filePath: file,
                    outputFolder: `${outputFolder}/${fileName}`,
                    jobMonitorInterval,
                })
                await reportProgress(file, 'SUCCEEDED')
            } catch (error) {
                console.error(error)
                await reportProgress(file, 'FAILED')
            }
        }

        async function addToQueue(file: string) {
            try {
                await reportProgress(file, 'PENDING')
                queue.add(async () => await queueListener(file))
            } catch (error) {
                console.error(error)
            }
        }

        async function reportProgress(file: string, status: JobStatus) {
            try {
                console.log(`Progress: File ${file} -> ${status}`)

                report[file] = { status }

                if (onProgress) {
                    const reportBreakdown: ReportBreakdown = {
                        PENDING: [],
                        PROCESSING: [],
                        SUCCEEDED: [],
                        FAILED: [],
                        DELETED: [],
                        QUEUED: [],
                        CANCELLED: [],
                        STARTED: [],
                    }

                    for (const filePath in report) {
                        reportBreakdown[report[filePath].status].push(filePath)
                    }

                    await onProgress(file, status, reportBreakdown)
                }
            } catch (error) {
                console.error(error)
            }
        }

        const globOptions = `${inputFolder}/*.@(mp3|wav|m4a)`
        const files = await glob(globOptions, {})

        for (const file of files) {
            await addToQueue(file)
        }

        await queue.onIdle()

        resolve(results)
    })
}

async function getJob(apiKey: string, id: string) {
    return apiCall({ method: 'GET', path: `/api/job/${id}`, apiKey })
}

async function deleteJob(apiKey: string, id: string) {
    return apiCall({ method: 'DELETE', path: `/api/job/${id}`, apiKey })
}

async function waitForJobCompletion(
    apiKey: string,
    id: string,
    jobMonitorInterval = 1000
) {
    while (true) {
        const job = await getJob(apiKey, id)
        if (job.status === 'SUCCEEDED' || job.status === 'FAILED') {
            console.log(`Progress: Job ${job} -> ${job.status}`)

            return job
        }
        await sleep(jobMonitorInterval)
    }
}

async function downloadJobResults(
    apiKey: string,
    jobIdOrJobData: string | JobData,
    outputFolder: string
) {
    let job: JobData =
        typeof jobIdOrJobData === 'string'
            ? await getJob(apiKey, jobIdOrJobData)
            : jobIdOrJobData

    if (job.status === 'QUEUED' || job.status === 'STARTED') {
        throw new Error('Cant download job results: Job is not completed')
    }

    if (job.status === 'FAILED') {
        throw new Error('Cant download job results: Job has failed')
    }

    const downloads = []
    const downloadResult: DownloadResult = {}
    for (const result in job.result) {
        const value = job.result[result]
        if (value.startsWith('https://')) {
            const downloadDestination = `${outputFolder}/${result}.${extractFileExtensionFromFileUrl(
                value
            )}`
            downloads.push(downloadFile(value, downloadDestination))
            downloadResult[result] = downloadDestination
        }
    }

    await Promise.all(downloads)

    return downloadResult
}

export default {
    processFolder,
    processFile,
}
