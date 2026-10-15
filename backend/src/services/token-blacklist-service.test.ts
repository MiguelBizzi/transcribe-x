import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { TokenBlacklist } from './token-blacklist-service'

const day = 86_400_000

describe('TokenBlacklist', () => {
    it('treats a token as blacklisted until it expires', async () => {
        const blacklist = new TokenBlacklist()
        await blacklist.blacklistToken(
            'active',
            'user-1',
            new Date(Date.now() + day),
        )

        assert.equal(await blacklist.isTokenBlacklisted('active'), true)
        assert.equal(await blacklist.isTokenBlacklisted('missing'), false)
    })

    it('defaults the reason to logout', async () => {
        const blacklist = new TokenBlacklist()
        await blacklist.blacklistToken(
            'active',
            'user-1',
            new Date(Date.now() + day),
        )
        const stats = await blacklist.getStats()
        assert.equal(stats.activeBlacklisted, 1)
        assert.equal(stats.expiredBlacklisted, 0)
        assert.equal(stats.totalBlacklisted, 1)
    })

    it('forgets an expired token when it is checked', async () => {
        const blacklist = new TokenBlacklist()
        await blacklist.blacklistToken(
            'old',
            'user-1',
            new Date(Date.now() - day),
        )

        assert.equal(await blacklist.isTokenBlacklisted('old'), false)
        const stats = await blacklist.getStats()
        assert.equal(stats.totalBlacklisted, 0)
    })

    it('removes expired tokens during cleanup and keeps the active ones', async () => {
        const blacklist = new TokenBlacklist()
        await blacklist.blacklistToken(
            'old',
            'user-1',
            new Date(Date.now() - day),
        )
        await blacklist.blacklistToken(
            'active',
            'user-1',
            new Date(Date.now() + day),
            'security',
        )

        const before = await blacklist.getStats()
        assert.equal(before.expiredBlacklisted, 1)
        assert.equal(before.activeBlacklisted, 1)

        await blacklist.cleanupExpiredTokens()
        const after = await blacklist.getStats()
        assert.equal(after.expiredBlacklisted, 0)
        assert.equal(after.activeBlacklisted, 1)
        assert.equal(after.totalBlacklisted, 1)
    })

    it('clears every token', async () => {
        const blacklist = new TokenBlacklist()
        await blacklist.blacklistToken(
            'active',
            'user-1',
            new Date(Date.now() + day),
        )
        await blacklist.clearAll()
        assert.equal((await blacklist.getStats()).totalBlacklisted, 0)
    })
})
