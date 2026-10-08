import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    DATASET_FIELDS,
    serializeDataset,
    type DatasetFormat,
    type DatasetRecord,
} from './dataset-serializer'

const curated: DatasetRecord = {
    id: 'vid-1',
    title: 'Aula 1',
    youtubeId: 'abc123',
    playlistId: 'pl-1',
    language: 'pt',
    dataset: 'curated',
    deduplicationStatus: 'kept',
    dedupGroupId: 'group-1',
    qualityScore: 0.81,
    mtldScore: 42.5,
    mattrScore: 0.73,
    llmCurationScore: 0.7,
    recommendation: 'pretraining',
    coherence: 7,
    richness: 6,
    factuality: 8,
    curationOverall: 7,
    curationRationale: 'Texto contínuo e coerente.',
    curationProvider: 'openai',
    curationModel: 'gpt-4o-mini',
    curationChunkCount: 1,
    text: 'Prosa processada da aula.',
}

const pending: DatasetRecord = {
    id: 'vid-2',
    title: 'Aula 2, com vírgula',
    youtubeId: 'def456',
    playlistId: 'pl-1',
    language: 'pt',
    dataset: 'processed',
    deduplicationStatus: 'pending',
    dedupGroupId: null,
    qualityScore: 0.9,
    mtldScore: 50,
    mattrScore: 0.8,
    llmCurationScore: null,
    recommendation: null,
    coherence: null,
    richness: null,
    factuality: null,
    curationOverall: null,
    curationRationale: null,
    curationProvider: null,
    curationModel: null,
    curationChunkCount: null,
    text: 'Texto ainda sem curadoria.',
}

const records = [curated, pending]
const formats: DatasetFormat[] = ['json', 'csv', 'txt', 'md', 'xml']

describe('serializeDataset', () => {
    it('emits the same fields in every format', () => {
        for (const format of formats) {
            const { content } = serializeDataset(records, format, 'curated')
            for (const field of DATASET_FIELDS) {
                assert.match(content, new RegExp(field), `${format} missing ${field}`)
            }
            assert.match(content, /vid-1/)
            assert.match(content, /vid-2/)
            assert.match(content, /Prosa processada da aula\./)
            assert.match(content, /Texto contínuo e coerente\./)
            assert.match(content, /Texto ainda sem curadoria\./)
            assert.doesNotMatch(content, /jsonl/)
            assert.doesNotMatch(content, /rewriteMode/)
            assert.doesNotMatch(content, /instruction/)
        }
    })

    it('serializes JSON as an array of complete records', () => {
        const parsed = JSON.parse(
            serializeDataset(records, 'json', 'curated').content,
        ) as DatasetRecord[]
        assert.equal(parsed.length, 2)
        assert.deepEqual(Object.keys(parsed[0]), [...DATASET_FIELDS])
        assert.equal(parsed[0].coherence, 7)
        assert.equal(parsed[0].curationRationale, 'Texto contínuo e coerente.')
        assert.equal(parsed[0].dedupGroupId, 'group-1')
        assert.equal(parsed[0].text, 'Prosa processada da aula.')
        assert.equal(parsed[1].recommendation, null)
        assert.equal(parsed[1].curationChunkCount, null)
    })

    it('uses one CSV column per field', () => {
        const { content } = serializeDataset(records, 'csv', 'processed')
        const [header, first, second] = content.split('\n')
        assert.equal(header, DATASET_FIELDS.join(','))
        assert.equal(first.split(',').length, DATASET_FIELDS.length)
        assert.match(second, /^vid-2,"Aula 2, com vírgula"/)
    })

    it('delimits TXT, Markdown, and XML records', () => {
        const txt = serializeDataset(records, 'txt', 'curated').content
        assert.equal(txt.match(/<<<RECORD>>>/g)?.length, 2)
        assert.equal(txt.match(/<<<END>>>/g)?.length, 2)
        assert.match(txt, /^# dataset: curated\n# records: 2/)
        assert.match(txt, /curationRationale: Texto contínuo e coerente\./)
        assert.match(txt, /text<<<\nProsa processada da aula\.\n>>>/)
        assert.doesNotMatch(txt, /instruction<<</)

        const md = serializeDataset(records, 'md', 'curated').content
        assert.equal(md.match(/^## text$/gm)?.length, 2)
        assert.equal(md.match(/^## instruction$/gm), null)
        assert.match(md, /^- stage: curated\n- records: 2/m)
        assert.match(md, /coherence: 7/)
        assert.match(md, /dedupGroupId: null/)

        const xml = serializeDataset(records, 'xml', 'curated').content
        assert.equal(xml.match(/<record>/g)?.length, 2)
        assert.match(
            xml,
            /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<dataset recordCount="2" stage="curated">/,
        )
        for (const field of DATASET_FIELDS) {
            assert.equal(xml.match(new RegExp(`<${field}>`, 'g'))?.length, 2)
        }
    })

    it('escapes XML text and TXT delimiter lines', () => {
        const tricky: DatasetRecord = {
            ...curated,
            title: 'A < B & C',
            text: 'antes\n>>>\ndepois',
        }
        const xml = serializeDataset([tricky], 'xml', 'curated').content
        assert.match(xml, /<title>A &lt; B &amp; C<\/title>/)
        assert.doesNotMatch(xml, /<title>A < B/)

        const txt = serializeDataset([tricky], 'txt', 'curated').content
        assert.match(txt, /text<<<\nantes\n\\>>>\ndepois\n>>>/)
    })

    it('returns a mime type for each format', () => {
        assert.match(serializeDataset([], 'md', 'raw').mimeType, /markdown/)
        assert.match(serializeDataset([], 'xml', 'raw').mimeType, /xml/)
        assert.match(serializeDataset([], 'txt', 'raw').mimeType, /text\/plain/)
        assert.match(serializeDataset([], 'json', 'raw').mimeType, /json/)
        assert.match(serializeDataset([], 'csv', 'raw').mimeType, /csv/)
        const xml = serializeDataset([], 'xml', 'raw').content
        assert.match(xml, /recordCount="0"/)
        assert.equal(xml.match(/<record>/g), null)
    })
})
