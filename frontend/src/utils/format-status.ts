const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  PROCESSING: 'Processando',
  COMPLETED: 'Concluído',
  ERROR: 'Erro',
}

const TYPE_LABELS: Record<string, string> = {
  VIDEO: 'Vídeo',
  PLAYLIST: 'Playlist',
  CHANNEL: 'Canal',
}

export function formatStatus(status: string): string {
  return STATUS_LABELS[status.toUpperCase()] ?? status
}

export function formatPlaylistStatus(
  status: string,
  failedCount: number,
): string {
  const normalized = status.toUpperCase()
  if (normalized === 'PROCESSING' || normalized === 'PENDING') {
    return 'Processando'
  }
  if (normalized === 'ERROR') return 'Erro'
  if (failedCount > 0) return 'Concluída com falhas'
  return 'Concluído'
}

export function formatTranscriptionType(type: string): string {
  return TYPE_LABELS[type.toUpperCase()] ?? type
}
