import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { z } from 'zod'
import { BadRequestError } from './routes/_errors/bad-request-error'
import { UnauthorizedError } from './routes/_errors/unauthorized-error'
import { errorHandler } from './error-handler'

function captureReply() {
    const reply = {
        statusCode: 0,
        payload: undefined as unknown,
        status(code: number) {
            this.statusCode = code
            return this
        },
        send(body: unknown) {
            this.payload = body
            return this
        },
    }
    return reply
}

describe('errorHandler', () => {
    it('returns field errors for a Zod failure', () => {
        const parsed = z.object({ email: z.string().email() }).safeParse({
            email: 'not-an-email',
        })
        assert.equal(parsed.success, false)
        if (parsed.success) return

        const reply = captureReply()
        errorHandler(parsed.error, {} as never, reply as never)
        assert.equal(reply.statusCode, 400)
        assert.deepEqual(reply.payload, {
            message: 'Validation error.',
            errors: parsed.error.flatten().fieldErrors,
        })
    })

    it('returns 400 for a bad request', () => {
        const reply = captureReply()
        errorHandler(
            new BadRequestError('Invalid email or password'),
            {} as never,
            reply as never,
        )
        assert.equal(reply.statusCode, 400)
        assert.deepEqual(reply.payload, {
            message: 'Invalid email or password',
        })
    })

    it('returns 401 for an unauthorized error', () => {
        const reply = captureReply()
        errorHandler(
            new UnauthorizedError('Token has expired'),
            {} as never,
            reply as never,
        )
        assert.equal(reply.statusCode, 401)
        assert.deepEqual(reply.payload, { message: 'Token has expired' })
    })

    it('hides unexpected failures behind a generic 500', () => {
        const reply = captureReply()
        const original = console.error
        console.error = () => undefined
        try {
            errorHandler(new Error('database down'), {} as never, reply as never)
        } finally {
            console.error = original
        }
        assert.equal(reply.statusCode, 500)
        assert.deepEqual(reply.payload, { message: 'Internal server error.' })
    })
})
