export interface BlacklistedToken {
    token: string
    userId: string
    blacklistedAt: Date
    expiresAt: Date
    reason: 'logout' | 'security' | 'admin_action'
}

export class TokenBlacklist {
    private blacklistedTokens: Map<string, BlacklistedToken> = new Map()

    async blacklistToken(
        token: string,
        userId: string,
        expiresAt: Date,
        reason: BlacklistedToken['reason'] = 'logout',
    ): Promise<void> {
        const blacklistedToken: BlacklistedToken = {
            token,
            userId,
            blacklistedAt: new Date(),
            expiresAt,
            reason,
        }

        this.blacklistedTokens.set(token, blacklistedToken)
    }

    async isTokenBlacklisted(token: string): Promise<boolean> {
        const blacklistedToken = this.blacklistedTokens.get(token)

        if (!blacklistedToken) {
            return false
        }

        if (blacklistedToken.expiresAt < new Date()) {
            this.blacklistedTokens.delete(token)
            return false
        }

        return true
    }

    async cleanupExpiredTokens(): Promise<void> {
        const now = new Date()
        for (const [
            token,
            blacklistedToken,
        ] of this.blacklistedTokens.entries()) {
            if (blacklistedToken.expiresAt < now) {
                this.blacklistedTokens.delete(token)
            }
        }
    }

    async getStats(): Promise<{
        totalBlacklisted: number
        activeBlacklisted: number
        expiredBlacklisted: number
    }> {
        const now = new Date()
        let activeCount = 0
        let expiredCount = 0

        for (const blacklistedToken of this.blacklistedTokens.values()) {
            if (blacklistedToken.expiresAt < now) {
                expiredCount++
            } else {
                activeCount++
            }
        }

        return {
            totalBlacklisted: this.blacklistedTokens.size,
            activeBlacklisted: activeCount,
            expiredBlacklisted: expiredCount,
        }
    }

    async clearAll(): Promise<void> {
        this.blacklistedTokens.clear()
    }
}

export const tokenBlacklist = new TokenBlacklist()
