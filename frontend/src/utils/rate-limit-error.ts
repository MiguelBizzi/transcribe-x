export function isRateLimitError(message?: string | null): boolean {
  if (!message) return false
  const normalized = message.toLowerCase()
  return (
    normalized.includes('limitou o acesso às legendas') ||
    normalized.includes('limitou temporariamente o acesso às legendas')
  )
}
