const SENTENCE_RE = /(?<=[.!?])\s+/

export function splitSentences(text: string): string[] {
    return text
        .split(SENTENCE_RE)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 0)
}

export function requireVideoDedupSource(
    transcription: {
        content: string | null
        processedContent: string | null
    } | null,
): string {
    if (!transcription) {
        throw new Error('Transcription not found')
    }

    const source =
        transcription.processedContent?.trim() ||
        transcription.content?.trim() ||
        ''

    if (!source) {
        throw new Error('Transcription has no content to deduplicate')
    }

    return source
}

export function sentenceSegments(
    transcriptionId: string,
    sentences: string[],
): Array<{ id: string; text: string }> {
    return sentences.map((text, index) => ({
        id: `${transcriptionId}:${index}`,
        text,
    }))
}

export function rebuildDeduplicatedText(
    sentences: string[],
    duplicates: Array<{ id: string }>,
): { processedContent: string; sentencesRemoved: number } {
    const duplicateIndexes = new Set(
        duplicates.map((duplicate) => {
            const [, index] = duplicate.id.split(':')
            return Number(index)
        }),
    )
    const keptSentences = sentences.filter(
        (_, index) => !duplicateIndexes.has(index),
    )

    return {
        processedContent: keptSentences.join(' '),
        sentencesRemoved: duplicateIndexes.size,
    }
}

export function documentDedupSegments(
    transcriptions: Array<{
        id: string
        content: string | null
        processedContent: string | null
    }>,
): Array<{ id: string; text: string }> {
    return transcriptions
        .map((transcription) => ({
            id: transcription.id,
            text:
                transcription.processedContent?.trim() ||
                transcription.content?.trim() ||
                '',
        }))
        .filter((segment) => segment.text.length > 0)
}

export function documentDedupAssignments(
    transcriptions: Array<{ id: string }>,
    result: {
        duplicates: Array<{ id: string }>
        groups: Array<{ groupId: string; members: Array<{ id: string }> }>
    },
): Array<{
    id: string
    deduplicationStatus: 'duplicate' | 'kept'
    dedupGroupId: string
}> {
    const duplicateById = new Map(
        result.duplicates.map((duplicate) => [duplicate.id, duplicate]),
    )
    const groupIdByMember = new Map<string, string>()

    for (const group of result.groups) {
        for (const member of group.members) {
            groupIdByMember.set(member.id, group.groupId)
        }
    }

    return transcriptions.map((transcription) => {
        const duplicate = duplicateById.get(transcription.id)
        return {
            id: transcription.id,
            deduplicationStatus: duplicate ? 'duplicate' : 'kept',
            dedupGroupId:
                groupIdByMember.get(transcription.id) ?? transcription.id,
        }
    })
}

export function requireDedupPayload<TStats, TGroup, TDuplicate>(response: {
    success: boolean
    groups?: TGroup[]
    duplicates?: TDuplicate[]
    stats?: TStats
    error?: string
}): { groups: TGroup[]; duplicates: TDuplicate[]; stats: TStats } {
    if (!response.success || !response.stats) {
        throw new Error(response.error || 'Deduplication failed')
    }

    return {
        groups: response.groups ?? [],
        duplicates: response.duplicates ?? [],
        stats: response.stats,
    }
}
