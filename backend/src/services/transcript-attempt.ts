export const INTER_VIDEO_DELAY_MS = 2_000

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
