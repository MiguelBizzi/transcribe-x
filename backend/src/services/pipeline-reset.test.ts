import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Prisma } from '@/generated/prisma/client'
import { downstreamResetData } from './pipeline-reset'

describe('downstreamResetData', () => {
    it('clears deduplication and curation and leaves rewrite fields out', () => {
        assert.deepEqual(Object.keys(downstreamResetData).sort(), [
            'dedupGroupId',
            'deduplicationStatus',
            'llmCurationData',
            'llmCurationScore',
        ])
        assert.equal(downstreamResetData.deduplicationStatus, 'pending')
        assert.equal(downstreamResetData.dedupGroupId, null)
        assert.equal(downstreamResetData.llmCurationScore, null)
        assert.equal(downstreamResetData.llmCurationData, Prisma.DbNull)
    })
})
