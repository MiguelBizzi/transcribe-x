import { readFileSync } from 'node:fs'
import process from 'node:process'
import { setInterval } from 'node:timers'

const payload = JSON.parse(readFileSync(0, 'utf8'))

if (payload.is_generated) {
    setInterval(() => {}, 60_000)
} else {
    process.stdout.write(
        JSON.stringify({
            success: true,
            processedText: `cleaned: ${payload.text}`,
            qualityMetrics: { mattrScore: 0.8, mtldScore: 60 },
        }),
    )
}
