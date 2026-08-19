import { tokenBlacklist } from '../services/token-blacklist-service'
import { prisma } from '../lib/prisma'
import * as cron from 'node-cron'

export interface CleanupConfig {
    schedule: string
    timezone: string
    enabled: boolean
}

export class CleanupJobs {
    private cleanupTask: cron.ScheduledTask | null = null
    private config: CleanupConfig = {
        schedule: '0 * * * *', // Every 1 hour
        timezone: 'UTC',
        enabled: true,
    }

    start(): void {
        if (this.cleanupTask) {
            console.log('Cleanup jobs already running')
            return
        }

        if (!this.config.enabled) {
            console.log('Cleanup jobs are disabled')
            return
        }

        console.log('Starting cleanup jobs...')
        console.log(`Schedule: ${this.config.schedule}`)
        console.log(`Timezone: ${this.config.timezone}`)

        if (!CleanupJobs.validateSchedule(this.config.schedule)) {
            console.error(`Invalid cron schedule: ${this.config.schedule}`)
            return
        }

        this.cleanupTask = cron.schedule(
            this.config.schedule,
            async () => {
                try {
                    await this.runCleanup()
                } catch (error) {
                    console.error('Error during cleanup:', error)
                }
            },
            {
                timezone: this.config.timezone,
            },
        )

        this.runCleanup()

        console.log('Cleanup jobs started successfully')
    }

    stop(): void {
        if (this.cleanupTask) {
            this.cleanupTask.stop()
            this.cleanupTask.destroy()
            this.cleanupTask = null
            console.log('Cleanup jobs stopped')
        }
    }

    updateConfig(newConfig: Partial<CleanupConfig>): void {
        const wasRunning = !!this.cleanupTask

        if (wasRunning) {
            this.stop()
        }

        this.config = { ...this.config, ...newConfig }

        if (wasRunning && this.config.enabled) {
            this.start()
        }
    }

    private async runCleanup(): Promise<void> {
        const startTime = Date.now()
        const timestamp = new Date().toISOString()

        try {
            console.log(`[${timestamp}] Starting cleanup cycle...`)

            await this.cleanupExpiredTokens()
            await this.cleanupOldActivityLogs()

            const duration = Date.now() - startTime
            console.log(`[${timestamp}] Cleanup completed in ${duration}ms`)
        } catch (error) {
            console.error(`[${timestamp}] Cleanup failed:`, error)
        }
    }

    private async cleanupExpiredTokens(): Promise<void> {
        try {
            await tokenBlacklist.cleanupExpiredTokens()
            const stats = await tokenBlacklist.getStats()

            if (stats.expiredBlacklisted > 0) {
                console.log(
                    `Cleaned up ${stats.expiredBlacklisted} expired blacklisted tokens`,
                )
            }
        } catch (error) {
            console.error('Error cleaning up expired tokens:', error)
        }
    }

    private async cleanupOldActivityLogs(): Promise<void> {
        try {
            const ninetyDaysAgo = new Date()
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

            const result = await prisma.recentActivity.deleteMany({
                where: {
                    createdAt: {
                        lt: ninetyDaysAgo,
                    },
                },
            })

            if (result.count > 0) {
                console.log(`Cleaned up ${result.count} old activity logs`)
            }
        } catch (error) {
            console.error('Error cleaning up old activity logs:', error)
        }
    }

    static validateSchedule(schedule: string): boolean {
        return cron.validate(schedule)
    }
}

export const cleanupJobs = new CleanupJobs()
