import '../test/setup-env'
import assert from 'node:assert/strict'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { TextQualityService } from './text-quality-service'

const fixtures = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'lib',
    'fixtures',
)

function serviceFor(fixture: string, timeout = 400) {
    return new TextQualityService({
        pythonPath: process.execPath,
        scriptPath: path.join(fixtures, fixture),
        timeout,
    })
}

describe('TextQualityService.processText', () => {
    const originalError = console.error
    const originalWarn = console.warn
    let errors: unknown[][]
    let warnings: unknown[][]

    beforeEach(() => {
        errors = []
        warnings = []
        console.error = (...args: unknown[]) => void errors.push(args)
        console.warn = (...args: unknown[]) => void warnings.push(args)
    })

    afterEach(() => {
        console.error = originalError
        console.warn = originalWarn
    })

    it('falls back to processing without spellcheck when it times out', async () => {
        const service = serviceFor('text-processor-slow-spellcheck.mjs')

        const result = await service.processText('hello world', 'pt', true)

        assert.equal(result?.processedText, 'cleaned: hello world')
        assert.equal(warnings.length, 1)
    })

    it('does not retry text that was not spellchecked', async () => {
        const service = serviceFor('text-processor-always-fails.mjs')

        const result = await service.processText('hello world', 'pt', false)

        assert.equal(result, null)
        assert.equal(warnings.length, 0)
        assert.equal(errors.length, 1)
    })

    it('reports the failure instead of swallowing it', async () => {
        const service = serviceFor('text-processor-always-fails.mjs')

        const result = await service.processText('hello world', 'pt', true)

        assert.equal(result, null)
        assert.match(String(errors.at(-1)?.[0]), /Text processing failed/)
    })

    it('returns null for blank text without running the script', async () => {
        const service = serviceFor('text-processor-always-fails.mjs')

        assert.equal(await service.processText('   ', 'pt', true), null)
        assert.equal(errors.length, 0)
    })
})
