# ls-node-cli-template

Non-official [Moises AI](https://developer.moises.ai/) API wrapper package with Typescript support

## Install

`yarn add moises-node`

or

`npm i moises-node`

## How to use it?

```typescript
import { processFile, processFolder } from 'moises-node'

// types

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

// functions
async function processFile({
    apiKey,
    workflowId,
    filePath,
    outputFolder,
    jobMonitorInterval,
    onProgress,
    onLog,
    onError,
}: ProcessFileOptions) : Promise<DownloadResult>

async function processFolder({
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
}: ProcessFolderOptions): Promise<DownloadResult[]>
```