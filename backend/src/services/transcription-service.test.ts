import '../test/setup-env'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { transcriptionService } from './transcription-service'

describe('TranscriptionService local failures', () => {
    it('rejects a url that does not contain a video id', async () => {
        const result = await transcriptionService.getTranscriptByUrl(
            'https://example.com/watch',
        )
        assert.equal(result.success, false)
        assert.equal(result.video_id, '')
        assert.equal(result.error_type, 'invalid_url')
    })

    it('rejects a video id shorter than 8 characters without calling Python', async () => {
        const result = await transcriptionService.getTranscriptById('abc')
        assert.equal(result.success, false)
        assert.equal(result.video_id, 'abc')
        assert.equal(result.error_type, 'invalid_video_id')
    })

    it('rejects an empty video id', async () => {
        const result = await transcriptionService.getTranscriptById('')
        assert.equal(result.error_type, 'invalid_video_id')
    })
})
