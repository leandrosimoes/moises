# moises-node

Non-official [Moises AI](https://developer.moises.ai/) API wrapper package with Typescript support

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/3e0b2e2d5b9d4157a26d7faebe3f5a6f)](https://app.codacy.com/gh/leandrosimoes/moises/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![npm version](https://badge.fury.io/js/moises-node.svg)](https://badge.fury.io/js/moises-node)
[![Node.js Package](https://github.com/leandrosimoes/moises/actions/workflows/npmpublish.yml/badge.svg)](https://github.com/leandrosimoes/moises/actions/workflows/npmpublish.yml)
[<img src="https://img.shields.io/badge/slack-@lesimoes/help-blue.svg?logo=slack">](https://lesimoes.slack.com/messages/C05GZ1F8P44) 
[<img src="https://img.shields.io/badge/discord-@lesimoes/help-blue.svg?logo=discord">](https://discord.gg/wSr8t8p4Vr) 


## Install

`yarn add moises-node`

or

`npm i moises-node`

## How to use it?

```typescript
// importing into your project
import { 
    processFile, 
    processFolder, 
    ProcessStatus, 
    ProcessFileOptions,
    JobStatus,
    DownloadResult
} from 'moises-node'

// types exported by the library
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

// functions exported by the library
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