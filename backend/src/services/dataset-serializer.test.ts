import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    DATASET_FIELDS,
    serializeDataset,
    type DatasetFormat,
    type DatasetRecord,
} from './dataset-serializer'

const prose: DatasetRecord = {
    id: 'vid-1',
    title: 'Aula 1',
    youtubeId: 'abc123',
    playlistId: 'pl-1',
    language: 'pt',
    dataset: 'rewritten',
    rewriteMode: 'pretraining',
    deduplicationStatus: 'kept',
    qualityScore: 0.81,
    mtldScore: 42.5,
    mattrScore: 0.73,
    llmCurationScore: 0.7,
    recommendation: 'pretraining',
    instruction: null,
    output: null,
    text: 'Prosa reescrita da aula.',
}

const sft: DatasetRecord = {
    id: 'vid-2',
    title: 'Aula 2, com vírgula',
    youtubeId: 'def456',
    playlistId: 'pl-1',
    language: 'pt',
    dataset: 'rewritten',
    rewriteMode: 'sft',
    deduplicationStatus: 'kept',
    qualityScore: 0.9,
    mtldScore: 50,
    mattrScore: 0.8,
    llmCurationScore: 0.88,
    recommendation: 'sft_example',
    instruction: 'Explique o tema.',
    output: 'A resposta ancorada.',
    text: 'A resposta ancorada.',
}

const records = [prose, sft]
const formats: DatasetFormat[] = ['json', 'jsonl', 'csv', 'txt', 'md', 'xml']

describe('serializeDataset', () => {
    it('emits the same fields in every format', () => {
        for (const format of formats) {
            const { content } = serializeDataset(records, format, 'rewritten')
            for (const field of DATASET_FIELDS) {
                assert.match(content, new RegExp(field), `${format} missing ${field}`)
            }
            assert.match(content, /vid-1/)
            assert.match(content, /vid-2/)
            assert.match(content, /Prosa reescrita da aula\./)
            assert.match(content, /Explique o tema\./)
            assert.match(content, /A resposta ancorada\./)
        }
    })

    it('keeps a full JSONL object for SFT pairs', () => {
        const { content } = serializeDataset(records, 'jsonl', 'rewritten')
        const lines = content.split('\n')
        assert.equal(lines.length, 2)
        for (const line of lines) {
            const parsed = JSON.parse(line) as Record<string, unknown>
            assert.deepEqual(Object.keys(parsed), [...DATASET_FIELDS])
        }
        const pair = JSON.parse(lines[1]) as DatasetRecord
        assert.equal(pair.instruction, 'Explique o tema.')
        assert.equal(pair.output, 'A resposta ancorada.')
        assert.equal(pair.qualityScore, 0.9)
        assert.equal(pair.mtldScore, 50)
        assert.equal(pair.playlistId, 'pl-1')
    })

    it('serializes JSON as an array of complete records', () => {
        const parsed = JSON.parse(
            serializeDataset(records, 'json', 'rewritten').content,
        ) as DatasetRecord[]
        assert.equal(parsed.length, 2)
        assert.deepEqual(Object.keys(parsed[0]), [...DATASET_FIELDS])
        assert.equal(parsed[0].instruction, null)
        assert.equal(parsed[0].output, null)
        assert.equal(parsed[1].text, parsed[1].output)
    })

    it('uses one CSV column per field', () => {
        const { content } = serializeDataset(records, 'csv', 'rewritten')
        const [header, first, second] = content.split('\n')
        assert.equal(header, DATASET_FIELDS.join(','))
        assert.equal(first.split(',').length, DATASET_FIELDS.length)
        assert.match(second, /^vid-2,"Aula 2, com vírgula"/)
    })

    it('delimits TXT, Markdown, and XML records', () => {
        const txt = serializeDataset(records, 'txt', 'rewritten').content
        assert.equal(txt.match(/<<<RECORD>>>/g)?.length, 2)
        assert.equal(txt.match(/<<<END>>>/g)?.length, 2)
        assert.match(txt, /^# dataset: rewritten\n# records: 2/)
        assert.match(txt, /instruction<<<\nExplique o tema\.\n>>>/)

        const md = serializeDataset(records, 'md', 'rewritten').content
        assert.equal(md.match(/^## text$/gm)?.length, 2)
        assert.equal(md.match(/^## instruction$/gm)?.length, 2)
        assert.equal(md.match(/^## output$/gm)?.length, 2)
        assert.match(md, /^- stage: rewritten\n- records: 2/m)

        const xml = serializeDataset(records, 'xml', 'rewritten').content
        assert.equal(xml.match(/<record>/g)?.length, 2)
        assert.match(
            xml,
            /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<dataset recordCount="2" stage="rewritten">/,
        )
        for (const field of DATASET_FIELDS) {
            assert.equal(xml.match(new RegExp(`<${field}>`, 'g'))?.length, 2)
        }
    })

    it('escapes XML text and TXT delimiter lines', () => {
        const tricky: DatasetRecord = {
            ...prose,
            title: 'A < B & C',
            text: 'antes\n>>>\ndepois',
            instruction: null,
            output: null,
        }
        const xml = serializeDataset([tricky], 'xml', 'rewritten').content
        assert.match(xml, /<title>A &lt; B &amp; C<\/title>/)
        assert.doesNotMatch(xml, /<title>A < B/)

        const txt = serializeDataset([tricky], 'txt', 'rewritten').content
        assert.match(txt, /text<<<\nantes\n\\>>>\ndepois\n>>>/)
    })

    it('returns a mime type for each format', () => {
        assert.match(serializeDataset([], 'md', 'raw').mimeType, /markdown/)
        assert.match(serializeDataset([], 'xml', 'raw').mimeType, /xml/)
        assert.match(serializeDataset([], 'txt', 'raw').mimeType, /text\/plain/)
        const xml = serializeDataset([], 'xml', 'raw').content
        assert.match(xml, /recordCount="0"/)
        assert.equal(xml.match(/<record>/g), null)
    })
})
