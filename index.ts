import { glob } from 'glob'
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

export type ProcessStatus =
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
        status: JobStatus | ProcessStatus,
        report: any
    ) => Promise<void>
    onLog?(message: string): Promise<void>
    onError?(message: string): Promise<void>
}

export type ProcessFileOptions = {
    apiKey: string
    workflowId: string
    filePath: string
    outputFolder: string
    jobMonitorInterval?: number
    onProgress?: (
        file: string,
        status: JobStatus | ProcessStatus,
        report: any
    ) => Promise<void>
    onLog?(message: string): Promise<void>
    onError?(message: string): Promise<void>
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

export type DownloadResult = {
    [key: string]: string
}

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

type ApiCallOptions = {
    method: string
    path: string
    data?: any
    apiKey: string
}

let onLogInternal = (message: string): Promise<void> => {
    return new Promise((resolve) => {
        console.log(message)
        resolve()
    })
}

let onErrorInternal = (message: string): Promise<void> => {
    return new Promise((resolve) => {
        console.error(message)
        resolve()
    })
}

let onProgressInternal = (
    file: string,
    status: JobStatus | ProcessStatus,
    reportBreakdown: ReportBreakdown
): Promise<void> => {
    return new Promise((resolve) => {
        console.log(file, status, reportBreakdown)
        resolve()
    })
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
    await onLogInternal(`Uploading file ${fileLocation} ...`)

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
    await onLogInternal(`Downloading file ${url} ...`)

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

const report: Report = {}
const results: DownloadResult[] = []

async function reportProgress(file: string, status: JobStatus) {
    try {
        await onLogInternal(`Progress: File ${file} -> ${status}`)

        report[file] = { status }

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

        await onProgressInternal(file, status, reportBreakdown)
    } catch (error: any) {
        await onErrorInternal(error)
    }
}

async function queueListener(
    apiKey: string,
    workflowId: string,
    file: string,
    outputFolder: string,
    jobMonitorInterval: number
) {
    try {
        await processFile({
            apiKey,
            workflowId: workflowId,
            filePath: file,
            outputFolder: outputFolder,
            jobMonitorInterval,
        })
    } catch (error: any) {
        await onErrorInternal(error)
        await reportProgress(file, 'FAILED')
    }
}

async function addToQueue(
    apiKey: string,
    workflowId: string,
    queue: PQueue,
    file: string,
    outputFolder: string,
    jobMonitorInterval: number
) {
    try {
        await reportProgress(file, 'PENDING')
        queue.add(
            async () =>
                await queueListener(
                    apiKey,
                    workflowId,
                    file,
                    outputFolder,
                    jobMonitorInterval
                )
        )
    } catch (error: any) {
        await onErrorInternal(error)
    }
}

export async function processFile({
    apiKey,
    workflowId,
    filePath,
    outputFolder,
    jobMonitorInterval,
    onProgress,
    onLog,
    onError,
}: ProcessFileOptions): Promise<DownloadResult> {
    if (!apiKey) throw new Error('API Key is required')
    if (!workflowId) throw new Error('Workflow ID is required')

    if (onProgress) onProgressInternal = onProgress
    if (onLog) onLogInternal = onLog
    if (onError) onErrorInternal = onError

    await reportProgress(filePath, 'PROCESSING')

    await onLogInternal(`Processing file: ${filePath} ...`)

    const name = path.basename(filePath).split('.').shift() ?? 'output'
    const inputUrl = await uploadFile(filePath, apiKey)
    const jobId = await addJob(name, workflowId, { inputUrl }, apiKey)
    const jobData = await waitForJobCompletion(
        apiKey,
        jobId,
        jobMonitorInterval
    )
    const result = await downloadJobResults(apiKey, jobData, outputFolder)

    results.push(result)

    await deleteJob(apiKey, jobId)

    await reportProgress(filePath, 'SUCCEEDED')

    return result
}

export function processFolder({
    apiKey,
    workflowId,
    inputFolder,
    outputFolder,
    maxConcurrencyNumber = 5,
    abortSignal,
    jobMonitorInterval = 1000,
    onProgress,
    onLog,
    onError,
}: ProcessFolderOptions): Promise<DownloadResult[]> {
    if (onProgress) onProgressInternal = onProgress
    if (onLog) onLogInternal = onLog
    if (onError) onErrorInternal = onError

    // This is needed because glob doesn't work with Windows paths
    if (process.platform === 'win32') {
        inputFolder = inputFolder.replace(/\\/g, '/')
        outputFolder = outputFolder.replace(/\\/g, '/')
    }

    return new Promise(async (resolve) => {
        await onLogInternal(
            `Processing folder: ${inputFolder} -> ${outputFolder} ...`
        )

        const queue = new PQueue({ concurrency: maxConcurrencyNumber })

        if (abortSignal) {
            abortSignal.addEventListener('abort', async () => {
                queue.clear()

                await queue.onIdle()

                await onLogInternal(`Queue aborted`)

                resolve(results)
            })
        }

        const globOptions = `${inputFolder}/*.@(mp3|wav|m4a)`
        const files = await glob(globOptions, {})

        for (const file of files) {
            await addToQueue(
                apiKey,
                workflowId,
                queue,
                file,
                outputFolder,
                jobMonitorInterval
            )
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
): Promise<APICallResponse> {
    const job = await getJob(apiKey, id)
    if (job.status === 'SUCCEEDED' || job.status === 'FAILED') {
        await onLogInternal(`Progress: Job ${job} -> ${job.status}`)
        return job
    }

    await sleep(jobMonitorInterval)
    return await waitForJobCompletion(apiKey, id, jobMonitorInterval)
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
