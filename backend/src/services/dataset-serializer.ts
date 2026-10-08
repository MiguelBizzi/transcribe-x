export type DatasetStage = 'raw' | 'processed' | 'curated'
export type DatasetFormat = 'json' | 'csv' | 'txt' | 'md' | 'xml'

export const DATASET_FIELDS = [
    'id',
    'title',
    'youtubeId',
    'playlistId',
    'language',
    'dataset',
    'deduplicationStatus',
    'dedupGroupId',
    'qualityScore',
    'mtldScore',
    'mattrScore',
    'llmCurationScore',
    'recommendation',
    'coherence',
    'richness',
    'factuality',
    'curationOverall',
    'curationRationale',
    'curationProvider',
    'curationModel',
    'curationChunkCount',
    'text',
] as const

export type DatasetField = (typeof DATASET_FIELDS)[number]

const TEXT_FIELDS = ['text'] as const
type TextField = (typeof TEXT_FIELDS)[number]

const SCALAR_FIELDS = DATASET_FIELDS.filter(
    (field): field is Exclude<DatasetField, TextField> =>
        !(TEXT_FIELDS as readonly string[]).includes(field),
)

export interface DatasetRecord {
    id: string
    title: string
    youtubeId: string
    playlistId: string | null
    language: string | null
    dataset: DatasetStage
    deduplicationStatus: string
    dedupGroupId: string | null
    qualityScore: number | null
    mtldScore: number | null
    mattrScore: number | null
    llmCurationScore: number | null
    recommendation: string | null
    coherence: number | null
    richness: number | null
    factuality: number | null
    curationOverall: number | null
    curationRationale: string | null
    curationProvider: string | null
    curationModel: string | null
    curationChunkCount: number | null
    text: string
}

export function datasetMimeType(format: DatasetFormat): string {
    switch (format) {
        case 'json':
            return 'application/json;charset=utf-8'
        case 'csv':
            return 'text/csv;charset=utf-8'
        case 'txt':
            return 'text/plain;charset=utf-8'
        case 'md':
            return 'text/markdown;charset=utf-8'
        case 'xml':
            return 'application/xml;charset=utf-8'
    }
}

export function canonicalRecord(record: DatasetRecord): DatasetRecord {
    return {
        id: record.id,
        title: record.title,
        youtubeId: record.youtubeId,
        playlistId: record.playlistId,
        language: record.language,
        dataset: record.dataset,
        deduplicationStatus: record.deduplicationStatus,
        dedupGroupId: record.dedupGroupId,
        qualityScore: record.qualityScore,
        mtldScore: record.mtldScore,
        mattrScore: record.mattrScore,
        llmCurationScore: record.llmCurationScore,
        recommendation: record.recommendation,
        coherence: record.coherence,
        richness: record.richness,
        factuality: record.factuality,
        curationOverall: record.curationOverall,
        curationRationale: record.curationRationale,
        curationProvider: record.curationProvider,
        curationModel: record.curationModel,
        curationChunkCount: record.curationChunkCount,
        text: record.text,
    }
}

function csvEscape(value: string | number | null | undefined): string {
    const text = value == null ? '' : String(value)
    if (/[",\n\r]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`
    }
    return text
}

function xmlEscape(value: string): string {
    return value
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

function singleLine(value: string): string {
    return value.replace(/\r?\n/g, ' ')
}

function yamlValue(value: string | number | null): string {
    if (value == null || (typeof value === 'number' && !Number.isFinite(value))) {
        return 'null'
    }
    if (typeof value === 'number') {
        return String(value)
    }
    return JSON.stringify(singleLine(value))
}

function scalarValue(
    record: DatasetRecord,
    field: Exclude<DatasetField, TextField>,
): string | number | null {
    return record[field]
}

function textValue(record: DatasetRecord, field: TextField): string {
    return record[field] ?? ''
}

function escapeTxtLine(line: string): string {
    if (line === '>>>' || line === '<<<RECORD>>>' || line === '<<<END>>>') {
        return `\\${line}`
    }
    return line
}

function serializeJson(records: DatasetRecord[]): string {
    return JSON.stringify(records.map(canonicalRecord), null, 2)
}

function serializeCsv(records: DatasetRecord[]): string {
    const header = DATASET_FIELDS.join(',')
    const rows = records.map((record) =>
        DATASET_FIELDS.map((field) => csvEscape(record[field])).join(','),
    )
    return [header, ...rows].join('\n')
}

function serializeTxt(records: DatasetRecord[], stage: DatasetStage): string {
    const header = `# dataset: ${stage}\n# records: ${records.length}`
    const blocks = records.map((record) => {
        const scalars = SCALAR_FIELDS.map((field) => {
            const value = scalarValue(record, field)
            return `${field}: ${value == null ? '' : singleLine(String(value))}`
        })
        const texts = TEXT_FIELDS.map((field) => {
            const body = textValue(record, field)
                .replace(/\r\n/g, '\n')
                .split('\n')
                .map(escapeTxtLine)
                .join('\n')
            const terminated =
                body.length === 0 || body.endsWith('\n') ? body : `${body}\n`
            return `${field}<<<\n${terminated}>>>`
        })
        return ['<<<RECORD>>>', ...scalars, ...texts, '<<<END>>>'].join('\n')
    })

    if (blocks.length === 0) {
        return header
    }

    return `${header}\n\n${blocks.join('\n\n')}`
}

function serializeMarkdown(records: DatasetRecord[], stage: DatasetStage): string {
    const header = [
        '# Dataset',
        '',
        `- stage: ${stage}`,
        `- records: ${records.length}`,
    ].join('\n')

    const blocks = records.map((record) => {
        const frontMatter = SCALAR_FIELDS.map(
            (field) => `${field}: ${yamlValue(scalarValue(record, field))}`,
        )
        const sections = TEXT_FIELDS.map((field) => {
            const body = textValue(record, field).replace(/\r\n/g, '\n').trim()
            return body ? `## ${field}\n\n${body}` : `## ${field}`
        })
        return ['---', ...frontMatter, '---', '', sections.join('\n\n')].join('\n')
    })

    return [header, ...blocks].join('\n\n')
}

function serializeXml(records: DatasetRecord[], stage: DatasetStage): string {
    const recordsXml = records
        .map((record) => {
            const fields = DATASET_FIELDS.map((field) => {
                const value = record[field]
                const text = value == null ? '' : xmlEscape(String(value))
                return `    <${field}>${text}</${field}>`
            }).join('\n')
            return `  <record>\n${fields}\n  </record>`
        })
        .join('\n')

    const body = recordsXml ? `\n${recordsXml}\n` : '\n'
    return `<?xml version="1.0" encoding="UTF-8"?>\n<dataset recordCount="${records.length}" stage="${xmlEscape(stage)}">${body}</dataset>\n`
}

export function serializeDataset(
    records: DatasetRecord[],
    format: DatasetFormat,
    stage: DatasetStage,
): { content: string; mimeType: string } {
    const content = (() => {
        switch (format) {
            case 'json':
                return serializeJson(records)
            case 'csv':
                return serializeCsv(records)
            case 'txt':
                return serializeTxt(records, stage)
            case 'md':
                return serializeMarkdown(records, stage)
            case 'xml':
                return serializeXml(records, stage)
        }
    })()

    return { content, mimeType: datasetMimeType(format) }
}
