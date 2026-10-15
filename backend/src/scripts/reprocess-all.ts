// One-off backfill: re-runs the text pipeline on every COMPLETED
// transcription so processedContent, qualityMetrics and rawQualityMetrics
// match the current text_processor.py (language-specific fillers, single
// letters kept, punctuation restoration when PUNCTUATION_RESTORATION is on).
//
// Downstream state is reset by default, like the manual reprocess route:
// dedup rewrites processedContent and LLM curation scores it, so both are
// stale once processedContent changes. Re-run dedup and curation afterwards.
//
// Resumable: only rows last updated before --updated-before are picked up,
// and processAndPersist bumps updatedAt. Re-running with the cutoff printed
// at start skips what is already done and retries what failed.
//
// Usage: pnpm reprocess:all [--dry-run] [--limit N] [--concurrency N]
//        [--updated-before ISO] [--keep-downstream] [--no-spellcheck]
import { parseArgs } from 'node:util'
import { TranscriptionStatus } from '@/generated/prisma/client'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { textQualityService } from '@/services/text-quality-service'

const { values } = parseArgs({
    options: {
        'dry-run': { type: 'boolean', default: false },
        limit: { type: 'string' },
        concurrency: { type: 'string', default: '1' },
        'updated-before': { type: 'string' },
        'keep-downstream': { type: 'boolean', default: false },
        'no-spellcheck': { type: 'boolean', default: false },
    },
})

function positiveInt(name: string, raw: string | undefined) {
    if (raw === undefined) return undefined
    const value = Number(raw)
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`--${name} must be a positive integer, got "${raw}"`)
    }
    return value
}

const limit = positiveInt('limit', values.limit)
const concurrency = positiveInt('concurrency', values.concurrency) ?? 1
const cutoff = values['updated-before']
    ? new Date(values['updated-before'])
    : new Date()
if (Number.isNaN(cutoff.getTime())) {
    throw new Error(`--updated-before is not a date: ${values['updated-before']}`)
}
const resetDownstream = !values['keep-downstream']
// The stored rows do not record whether captions were auto-generated; the
// manual reprocess route assumes they were, so spellcheck stays on here too.
const isGenerated = !values['no-spellcheck']

async function main() {
    const pending = await prisma.transcription.findMany({
        where: {
            status: TranscriptionStatus.COMPLETED,
            content: { not: null },
            updatedAt: { lt: cutoff },
        },
        select: { id: true, title: true, content: true, language: true },
        orderBy: { createdAt: 'asc' },
        take: limit,
    })
    const rows = pending.filter((row) => row.content?.trim())

    console.log(
        `[reprocess] cutoff=${cutoff.toISOString()} rows=${rows.length} ` +
            `concurrency=${concurrency} resetDownstream=${resetDownstream} ` +
            `spellcheck=${isGenerated} ` +
            `punctuation=${env.PUNCTUATION_RESTORATION}` +
            (values['dry-run'] ? ' (dry run)' : ''),
    )
    console.log(
        `[reprocess] to resume, re-run with --updated-before ${cutoff.toISOString()}`,
    )

    if (values['dry-run']) {
        for (const row of rows) {
            console.log(`[reprocess] would process ${row.id} ${row.title}`)
        }
        return
    }

    const failed: string[] = []
    let done = 0
    let next = 0

    async function worker() {
        while (next < rows.length) {
            const row = rows[next++]
            const started = Date.now()
            let ok = false
            try {
                const result = await textQualityService.processAndPersist(
                    row.id,
                    row.content,
                    row.language,
                    isGenerated,
                    { resetDownstream },
                )
                ok = result !== null
            } catch (error) {
                console.error(`[reprocess] ${row.id} threw:`, error)
            }
            done++
            if (!ok) failed.push(row.id)
            const seconds = ((Date.now() - started) / 1000).toFixed(1)
            console.log(
                `[reprocess] ${done}/${rows.length} ${ok ? 'ok' : 'FAILED'} ` +
                    `${row.id} (${seconds}s) ${row.title}`,
            )
        }
    }

    await Promise.all(
        Array.from({ length: Math.min(concurrency, rows.length) }, worker),
    )

    console.log(
        `[reprocess] finished: ${done - failed.length} ok, ${failed.length} failed`,
    )
    if (failed.length) {
        console.log(`[reprocess] failed ids: ${failed.join(' ')}`)
        process.exitCode = 1
    }
}

main()
    .catch((error) => {
        console.error('[reprocess] aborted:', error)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
