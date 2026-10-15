import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    generateNameFromEmail,
    getDisplayName,
} from './generate-name-from-email'

describe('generateNameFromEmail', () => {
    it('splits a dotted local part and capitalizes each piece', () => {
        assert.equal(generateNameFromEmail('john.doe@example.com'), 'John Doe')
        assert.equal(generateNameFromEmail('JOHN.DOE@example.com'), 'John Doe')
    })

    it('splits underscores when there is no dot', () => {
        assert.equal(generateNameFromEmail('jane_doe@example.com'), 'Jane Doe')
    })

    it('splits hyphens when there is no dot or underscore', () => {
        assert.equal(generateNameFromEmail('mary-jane@example.com'), 'Mary Jane')
    })

    it('does not mix separators: a dot wins and the rest stays in that piece', () => {
        assert.equal(generateNameFromEmail('a.b_c@example.com'), 'A B_c')
    })

    it('drops empty pieces between repeated dots', () => {
        assert.equal(generateNameFromEmail('a..b@example.com'), 'A B')
    })

    it('returns User when the address has no usable local part', () => {
        assert.equal(generateNameFromEmail(''), 'User')
        assert.equal(generateNameFromEmail('@example.com'), 'User')
    })

    it('capitalizes a single local token', () => {
        assert.equal(generateNameFromEmail('solo@example.com'), 'Solo')
    })
})

describe('getDisplayName', () => {
    it('uses the fallback when the email is missing', () => {
        assert.equal(getDisplayName(null), 'User')
        assert.equal(getDisplayName(undefined, 'Anon'), 'Anon')
    })

    it('derives the name from the email when one is present', () => {
        assert.equal(getDisplayName('ana.silva@example.com'), 'Ana Silva')
    })
})
