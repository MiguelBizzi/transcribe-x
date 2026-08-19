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

export function formatTranscriptionType(type: string): string {
  return TYPE_LABELS[type.toUpperCase()] ?? type
}
