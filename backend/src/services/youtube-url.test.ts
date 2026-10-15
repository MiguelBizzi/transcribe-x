import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    extractPlaylistId,
    extractVideoId,
    isPlaylistUrl,
    isValidYouTubeUrl,
    isVideoUrl,
    parseIso8601Duration,
} from './youtube-url'

describe('YouTube URL parsing', () => {
    it('reads a video id from watch, short, embed, and /v/ urls', () => {
        assert.equal(
            extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
            'dQw4w9WgXcQ',
        )
        assert.equal(
            extractVideoId('https://youtu.be/dQw4w9WgXcQ?t=10'),
            'dQw4w9WgXcQ',
        )
        assert.equal(
            extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ'),
            'dQw4w9WgXcQ',
        )
        assert.equal(
            extractVideoId('https://www.youtube.com/v/dQw4w9WgXcQ'),
            'dQw4w9WgXcQ',
        )
    })

    it('returns null when the url has no video id', () => {
        assert.equal(extractVideoId('https://example.com/watch'), null)
        assert.equal(isVideoUrl('https://example.com/watch'), false)
        assert.equal(isValidYouTubeUrl('https://example.com/watch'), false)
    })

    it('reads a playlist id from a playlist url and from a watch url that also has list', () => {
        assert.equal(
            extractPlaylistId(
                'https://www.youtube.com/playlist?list=PLabcdefghij',
            ),
            'PLabcdefghij',
        )
        assert.equal(
            extractPlaylistId(
                'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabcdefghij',
            ),
            'PLabcdefghij',
        )
        assert.equal(
            isPlaylistUrl('https://www.youtube.com/playlist?list=PLabcdefghij'),
            true,
        )
    })

    it('does not treat a playlist-only url as a video url', () => {
        const url = 'https://www.youtube.com/playlist?list=PLabcdefghij'
        assert.equal(isPlaylistUrl(url), true)
        assert.equal(isValidYouTubeUrl(url), false)
    })
})

describe('parseIso8601Duration', () => {
    it('converts hours, minutes, and seconds', () => {
        assert.equal(parseIso8601Duration('PT1H2M3S'), 3723)
        assert.equal(parseIso8601Duration('PT15M'), 900)
        assert.equal(parseIso8601Duration('PT45S'), 45)
        assert.equal(parseIso8601Duration('PT90M'), 5400)
        assert.equal(parseIso8601Duration('PT0S'), 0)
    })

    it('returns 0 when the string is not a time duration', () => {
        assert.equal(parseIso8601Duration('P1D'), 0)
        assert.equal(parseIso8601Duration('not-a-duration'), 0)
    })
})
