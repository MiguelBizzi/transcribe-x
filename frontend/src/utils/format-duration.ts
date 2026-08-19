export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '—'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  if (minutes > 0) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }

  return `${remainingSeconds}s`
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function formatQualityScore(score: number): string {
  return score.toFixed(2)
}

export function getQualityTone(score: number): 'good' | 'fair' | 'poor' {
  if (score >= 0.75) return 'good'
  if (score >= 0.5) return 'fair'
  return 'poor'
}
