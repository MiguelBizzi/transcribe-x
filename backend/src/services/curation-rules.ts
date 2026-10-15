export function curationTimeoutMs(text: string): number {
    const estimatedChunks = Math.min(
        10,
        Math.max(1, Math.ceil(text.length / 6000)),
    )
    return Math.min(120000 + estimatedChunks * 90000, 900000)
}

export function curationSourceText(
    processedContent?: string | null,
    content?: string | null,
): string {
    return processedContent?.trim() || content?.trim() || ''
}

export function assertCurationText(text: string): void {
    if (!text.trim()) {
        throw new Error('Text is required for curation')
    }
}

export function assertSingleCurationReady(
    deduplicationStatus: string,
    text: string,
): void {
    if (deduplicationStatus === 'pending') {
        throw new Error('Remova ou marque duplicatas antes da curadoria LLM.')
    }

    if (!text) {
        throw new Error('Transcription has no content to curate')
    }
}

export function curationScoreFromOverall(overall: number): number {
    return Number((overall / 10).toFixed(4))
}

export function shouldSkipPlaylistCuration(
    deduplicationStatus: string,
    llmCurationData: unknown,
): boolean {
    return (
        deduplicationStatus === 'pending' ||
        deduplicationStatus === 'duplicate' ||
        Boolean(llmCurationData)
    )
}

export function unavailableCurationMessage(error?: string): string {
    return error
        ? `Provedor de LLM indisponível: ${error}`
        : 'Provedor de LLM indisponível. Verifique a chave da API ou o Ollama local.'
}
