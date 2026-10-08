'use client'

import { exportFineTuningAction } from './actions'
import type { DatasetFormat, DatasetStage } from './types'

function triggerDownload(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function downloadFineTuningDataset(input: {
  scope: 'playlist' | 'user' | 'transcription'
  playlistId?: string
  transcriptionId?: string
  dataset: DatasetStage
  format: DatasetFormat
  includeDuplicates?: boolean
}): Promise<{
  recordCount: number
  skippedDuplicates: number
  skippedDiscarded: number
  skippedFailed: number
}> {
  const result = await exportFineTuningAction(input)

  if (result.serverError) {
    throw new Error(result.serverError)
  }

  if (
    !result.data ||
    result.data.success !== true ||
    !('content' in result.data)
  ) {
    throw new Error(
      result.data && 'message' in result.data
        ? result.data.message
        : 'Falha ao exportar',
    )
  }

  if (result.data.recordCount === 0) {
    throw new Error('Nenhum registro disponível para este estágio do dataset')
  }

  triggerDownload(
    result.data.filename,
    result.data.mimeType,
    result.data.content,
  )

  return {
    recordCount: result.data.recordCount,
    skippedDuplicates: result.data.skippedDuplicates,
    skippedDiscarded: result.data.skippedDiscarded,
    skippedFailed: result.data.skippedFailed,
  }
}

export function formatDatasetDownloadMessage(counts: {
  recordCount: number
  skippedFailed: number
}): string {
  if (counts.skippedFailed > 0) {
    return `${counts.recordCount} registros exportados. ${counts.skippedFailed} omitidos por falha.`
  }
  return `${counts.recordCount} registros exportados`
}
