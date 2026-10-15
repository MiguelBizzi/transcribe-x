import assert from 'node:assert/strict'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
    executePythonScript,
    resolvePythonPath,
    resolveScriptPath,
} from './python-runner'

const fixtures = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'fixtures',
)

describe('python runner paths', () => {
    it('keeps an explicit interpreter path', () => {
        assert.equal(resolvePythonPath(process.execPath), process.execPath)
    })

    it('resolves a script next to the scripts directory', () => {
        assert.equal(
            resolveScriptPath('deduplicator.py'),
            path.join(process.cwd(), 'scripts', 'deduplicator.py'),
        )
    })
})

describe('executePythonScript', () => {
    it('returns the JSON the child writes to stdout', async () => {
        const payload = { ok: true, n: 2 }
        const result = await executePythonScript<
            typeof payload,
            typeof payload
        >(path.join(fixtures, 'echo-stdin.mjs'), payload, {
            pythonPath: process.execPath,
            timeout: 2000,
        })
        assert.deepEqual(result, payload)
    })

    it('rejects output that is not JSON', async () => {
        await assert.rejects(
            () =>
                executePythonScript(
                    path.join(fixtures, 'invalid-json.mjs'),
                    { any: true },
                    { pythonPath: process.execPath, timeout: 2000 },
                ),
            /Failed to parse Python output/,
        )
    })

    it('rejects when the child exceeds the timeout', async () => {
        await assert.rejects(
            () =>
                executePythonScript(
                    path.join(fixtures, 'hang.mjs'),
                    {},
                    { pythonPath: process.execPath, timeout: 150 },
                ),
            /Python script timeout/,
        )
    })
})
