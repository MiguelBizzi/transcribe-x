import '../test/setup-env'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { envSchema } from './env'

const valid = {
    JWT_SECRET: 'secret',
    SERVER_PORT: '3000',
    DATABASE_URL: 'postgresql://localhost/transcribe',
    FRONTEND_URL: 'http://localhost:3000',
    GOOGLE_CLIENT_ID: 'client',
    GOOGLE_CLIENT_SECRET: 'secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:3000/callback',
    YOUTUBE_API_KEY: 'key',
}

describe('envSchema', () => {
    it('accepts a complete configuration', () => {
        assert.equal(envSchema.safeParse(valid).success, true)
    })

    it('rejects a port that is not numeric', () => {
        assert.equal(
            envSchema.safeParse({ ...valid, SERVER_PORT: 'abc' }).success,
            false,
        )
    })

    it('rejects a Jaccard threshold outside 0 to 1', () => {
        assert.equal(
            envSchema.safeParse({ ...valid, DEDUP_JACCARD_THRESHOLD: '1.5' })
                .success,
            false,
        )
        assert.equal(
            envSchema.safeParse({ ...valid, DEDUP_JACCARD_THRESHOLD: '-0.1' })
                .success,
            false,
        )
    })

    it('rejects an n-gram size outside 1 to 10', () => {
        assert.equal(
            envSchema.safeParse({ ...valid, DEDUP_NGRAM_SIZE: '0' }).success,
            false,
        )
        assert.equal(
            envSchema.safeParse({ ...valid, DEDUP_NGRAM_SIZE: '11' }).success,
            false,
        )
    })

    it('rejects an unknown curation provider', () => {
        assert.equal(
            envSchema.safeParse({
                ...valid,
                CURATION_LLM_PROVIDER: 'anthropic',
            }).success,
            false,
        )
    })
})
