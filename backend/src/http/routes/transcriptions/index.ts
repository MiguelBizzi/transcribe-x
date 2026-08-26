import { FastifyInstance } from 'fastify'
import { createVideoTranscription } from './create-video-transcription'
import { createPlaylistTranscription } from './create-playlist-transcription'
import { getLastTranscriptions } from './get-last-transcriptions'
import { getTranscriptions } from './get-transcriptions'
import { processTranscription } from './process-transcription'
import { getTranscriptionById } from './get-transcription-by-id'
import { getUserPlaylists } from './get-user-playlists'
import { getPlaylistById } from './get-playlist-by-id'
import { deduplicatePlaylist } from './deduplicate-playlist'
import { deduplicateTranscription } from './deduplicate-transcription'
import { deduplicateChannel } from './deduplicate-channel'
import { curateTranscription } from './curate-transcription'

export async function transcriptionRoutes(app: FastifyInstance) {
    app.register(createVideoTranscription, { prefix: '/transcriptions' })
    app.register(createPlaylistTranscription, { prefix: '/transcriptions' })
    app.register(getLastTranscriptions, { prefix: '/transcriptions' })
    app.register(getTranscriptions, { prefix: '/transcriptions' })
    app.register(processTranscription, { prefix: '/transcriptions' })
    app.register(deduplicatePlaylist, { prefix: '/transcriptions' })
    app.register(deduplicateChannel, { prefix: '/transcriptions' })
    app.register(deduplicateTranscription, { prefix: '/transcriptions' })
    app.register(curateTranscription, { prefix: '/transcriptions' })
    app.register(getTranscriptionById, { prefix: '/transcriptions' })
    app.register(getUserPlaylists, { prefix: '/transcriptions' })
    app.register(getPlaylistById, { prefix: '/transcriptions' })
}
