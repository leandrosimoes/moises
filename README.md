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
    shouldWatch?: boolean
    abortSignal?: AbortSignal
    jobMonitorInterval?: number
    onProgress?: (
        file: string,
        status: JobStatus | ProccessStatus,
        report: any
    ) => Promise<void>
    onLog?: typeof console.log
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

// functions
async function processFolder({
    apiKey,
    workflowId,
    inputFolder,
    outputFolder,
    maxConcurrencyNumber = 5,
    abortSignal,
    shouldWatch,
    jobMonitorInterval,
    onProgress,
    onLog,
}): : Promise<DownloadResult[]>
```