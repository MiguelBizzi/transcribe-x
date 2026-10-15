import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    assembleExportRecords,
    assertExportScope,
    exportFilename,
    type ExportTranscription,
} from './export-records'

const curation = {
    coherence: 7,
    richness: 6,
    factuality: 8,
    overall: 7.5,
    recommendation: 'pretraining',
    rationale: 'Coerente.',
    provider: 'openai',
    model: 'gpt-4o-mini',
    chunkCount: 2,
}

function row(overrides: Partial<ExportTranscription> = {}): ExportTranscription {
    return {
        id: 'vid-1',
        title: 'Aula',
        youtubeId: 'abc12345',
        playlistId: 'pl-1',
        language: 'pt',
        content: 'bruto',
        processedContent: 'processado',
        qualityMetrics: { qualityScore: 0.8 },
        mtldScore: 40,
        mattrScore: 0.7,
        llmCurationScore: 0.75,
        llmCurationData: curation,
        deduplicationStatus: 'kept',
        dedupGroupId: 'group-1',
        status: 'COMPLETED',
        ...overrides,
    }
}

const baseQuery = {
    userId: 'user-1',
    scope: 'user' as const,
    dataset: 'processed' as const,
    format: 'json',
}

describe('assembleExportRecords', () => {
    it('keeps raw text on the raw stage and does not fall back to processed text', () => {
        const assembled = assembleExportRecords(
            [row({ content: '  bruto  ', processedContent: 'processado' })],
            { ...baseQuery, dataset: 'raw' },
        )
        assert.equal(assembled.records[0].text, 'bruto')
        assert.equal(assembled.records[0].dataset, 'raw')
    })

    it('falls back to raw text for processed and curated stages', () => {
        const source = row({ content: 'bruto', processedContent: '   ' })
        assert.equal(
            assembleExportRecords([source], { ...baseQuery, dataset: 'processed' })
                .records[0].text,
            'bruto',
        )
        assert.equal(
            assembleExportRecords([source], { ...baseQuery, dataset: 'curated' })
                .records[0].text,
            'bruto',
        )
    })

    it('counts an error status as a failed skip before any other rule', () => {
        const assembled = assembleExportRecords(
            [row({ status: 'ERROR', deduplicationStatus: 'duplicate' })],
            baseQuery,
        )
        assert.equal(assembled.skippedFailed, 1)
        assert.equal(assembled.skippedDuplicates, 0)
        assert.equal(assembled.records.length, 0)
    })

    it('counts empty text as a failed skip', () => {
        const assembled = assembleExportRecords(
            [row({ content: '  ', processedContent: '' })],
            { ...baseQuery, dataset: 'processed' },
        )
        assert.equal(assembled.skippedFailed, 1)
        assert.equal(assembled.records.length, 0)
    })

    it('skips duplicates unless they are explicitly included', () => {
        const duplicate = row({ deduplicationStatus: 'duplicate' })
        const hidden = assembleExportRecords([duplicate], baseQuery)
        assert.equal(hidden.skippedDuplicates, 1)
        assert.equal(hidden.records.length, 0)

        const included = assembleExportRecords([duplicate], {
            ...baseQuery,
            includeDuplicates: true,
        })
        assert.equal(included.skippedDuplicates, 0)
        assert.equal(included.records.length, 1)
    })

    it('drops a curated row that has no curation without counting it as discarded', () => {
        const assembled = assembleExportRecords(
            [row({ llmCurationData: null })],
            { ...baseQuery, dataset: 'curated' },
        )
        assert.equal(assembled.records.length, 0)
        assert.equal(assembled.skippedDiscarded, 0)
        assert.equal(assembled.skippedFailed, 0)
    })

    it('counts a discarded recommendation separately', () => {
        const assembled = assembleExportRecords(
            [
                row({
                    llmCurationData: { ...curation, recommendation: 'discard' },
                }),
            ],
            { ...baseQuery, dataset: 'curated' },
        )
        assert.equal(assembled.skippedDiscarded, 1)
        assert.equal(assembled.records.length, 0)
    })

    it('copies curation scores and the dedup group onto the record', () => {
        const [record] = assembleExportRecords([row()], {
            ...baseQuery,
            dataset: 'curated',
        }).records
        assert.equal(record.dedupGroupId, 'group-1')
        assert.equal(record.coherence, 7)
        assert.equal(record.richness, 6)
        assert.equal(record.factuality, 8)
        assert.equal(record.curationOverall, 7.5)
        assert.equal(record.curationRationale, 'Coerente.')
        assert.equal(record.curationProvider, 'openai')
        assert.equal(record.curationModel, 'gpt-4o-mini')
        assert.equal(record.curationChunkCount, 2)
        assert.equal(record.qualityScore, 0.8)
        assert.equal(record.recommendation, 'pretraining')
    })
})

describe('export scope and filename', () => {
    it('requires a playlist id when the scope is a playlist', () => {
        assert.throws(
            () => assertExportScope({ scope: 'playlist' }),
            /playlistId is required when scope is playlist/,
        )
    })

    it('requires a transcription id when the scope is a transcription', () => {
        assert.throws(
            () => assertExportScope({ scope: 'transcription' }),
            /transcriptionId is required when scope is transcription/,
        )
    })

    it('names the file from the scope, stage, and format', () => {
        assert.equal(
            exportFilename({
                ...baseQuery,
                scope: 'playlist',
                playlistId: 'pl-9',
                dataset: 'curated',
                format: 'csv',
            }),
            'playlist-pl-9-curated.csv',
        )
        assert.equal(
            exportFilename({
                ...baseQuery,
                scope: 'transcription',
                transcriptionId: 'tr-2',
                format: 'xml',
            }),
            'transcription-tr-2-processed.xml',
        )
        assert.equal(
            exportFilename({ ...baseQuery, format: 'md' }),
            'user-user-1-processed.md',
        )
    })
})
