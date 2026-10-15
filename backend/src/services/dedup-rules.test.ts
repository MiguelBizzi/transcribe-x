import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    documentDedupAssignments,
    documentDedupSegments,
    rebuildDeduplicatedText,
    requireDedupPayload,
    requireVideoDedupSource,
    sentenceSegments,
    splitSentences,
} from './dedup-rules'

describe('splitSentences', () => {
    it('splits on sentence punctuation followed by whitespace', () => {
        assert.deepEqual(
            splitSentences('Uma frase. Outra! E outra? Fim.'),
            ['Uma frase.', 'Outra!', 'E outra?', 'Fim.'],
        )
    })

    it('does not split when punctuation is not followed by whitespace', () => {
        assert.deepEqual(splitSentences('Dr.Silva falou.'), ['Dr.Silva falou.'])
    })

    it('drops empty pieces', () => {
        assert.deepEqual(splitSentences('  '), [])
    })
})

describe('video deduplication', () => {
    it('rejects a missing transcription and a blank source', () => {
        assert.throws(
            () => requireVideoDedupSource(null),
            /Transcription not found/,
        )
        assert.throws(
            () =>
                requireVideoDedupSource({
                    content: '  ',
                    processedContent: null,
                }),
            /Transcription has no content to deduplicate/,
        )
    })

    it('prefers processed text over the raw caption', () => {
        assert.equal(
            requireVideoDedupSource({
                content: 'bruto',
                processedContent: ' limpo ',
            }),
            'limpo',
        )
    })

    it('drops duplicate sentence indexes and joins the rest with a single space', () => {
        const sentences = splitSentences('Alpha. Beta. Gamma.')
        const segments = sentenceSegments('vid-1', sentences)
        assert.deepEqual(
            segments.map((segment) => segment.id),
            ['vid-1:0', 'vid-1:1', 'vid-1:2'],
        )

        const rebuilt = rebuildDeduplicatedText(sentences, [
            { id: 'vid-1:1' },
        ])
        assert.equal(rebuilt.processedContent, 'Alpha. Gamma.')
        assert.equal(rebuilt.sentencesRemoved, 1)
    })
})

describe('document deduplication', () => {
    it('ignores documents that have no text', () => {
        const segments = documentDedupSegments([
            { id: 'a', content: 'texto', processedContent: null },
            { id: 'b', content: '  ', processedContent: null },
        ])
        assert.deepEqual(segments, [{ id: 'a', text: 'texto' }])
    })

    it('marks duplicates and keeps the group id, falling back to the document id', () => {
        const assignments = documentDedupAssignments(
            [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
            {
                duplicates: [{ id: 'b' }],
                groups: [
                    {
                        groupId: 'group-1',
                        members: [{ id: 'a' }, { id: 'b' }],
                    },
                ],
            },
        )
        assert.deepEqual(assignments, [
            { id: 'a', deduplicationStatus: 'kept', dedupGroupId: 'group-1' },
            {
                id: 'b',
                deduplicationStatus: 'duplicate',
                dedupGroupId: 'group-1',
            },
            { id: 'c', deduplicationStatus: 'kept', dedupGroupId: 'c' },
        ])
    })
})

describe('requireDedupPayload', () => {
    it('rejects a payload that did not succeed', () => {
        assert.throws(
            () => requireDedupPayload({ success: false, error: 'boom' }),
            /boom/,
        )
    })

    it('uses the default message when the payload has no error text', () => {
        assert.throws(
            () => requireDedupPayload({ success: true }),
            /Deduplication failed/,
        )
    })

    it('fills missing groups and duplicates with empty lists', () => {
        const stats = {
            inputCount: 1,
            comparedCount: 1,
            exactDuplicateCount: 0,
            nearDuplicateCount: 0,
            keptCount: 1,
            groupCount: 1,
        }
        assert.deepEqual(requireDedupPayload({ success: true, stats }), {
            groups: [],
            duplicates: [],
            stats,
        })
    })
})
