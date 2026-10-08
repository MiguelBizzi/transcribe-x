export interface QualityMetrics {
  originalWordCount: number
  processedWordCount: number
  noiseReductionRate: number
  lexicalDiversity: number
  mtldScore?: number | null
  mattrScore?: number
  avgSentenceLength: number
  hesitationCount: number
  repetitionCount: number
  timestampMarkersRemoved: number
  detectedLanguage: string
  processingDurationMs: number
  artifactRate?: number
  residualCommaCount?: number
  residualLetterCount?: number
  qualityScore: number
}

export type CurationRecommendation = 'sft_example' | 'pretraining' | 'discard'

export interface LlmCurationData {
  coherence: number
  richness: number
  factuality: number
  overall: number
  recommendation: CurationRecommendation
  rationale: string
  provider: string
  model: string
  chunkCount?: number
}

export interface TranscriptionJob {
  id: string
  title: string
  thumbnail: string
  url: string
  status: 'pending' | 'processing' | 'COMPLETED' | 'ERROR'
  progress: number
  estimatedTime?: string
  transcriptData?: {
    txt: string
    formats: string[]
  }
}

export interface TranscriptionPlaylistSummary {
  id: string
  title: string
  thumbnail: string | null
  videoCount: number
  status: string
}

export interface Transcription {
  id: string
  youtubeId: string
  title: string
  type: string
  thumbnail: string | null
  status: string
  content?: string | null
  duration: number | null
  wordCount: number | null
  language: string | null
  timestamps: Timestamp[] | null
  createdAt: string
  updatedAt: string
  playlistId?: string | null
  isPlaylistVideo?: boolean
  videoIndex?: number | null
  errorMessage?: string | null
  playlist?: TranscriptionPlaylistSummary | null
}

export interface TranscriptionDetail extends Transcription {
  content: string | null
  errorMessage: string | null
  processedContent: string | null
  qualityMetrics: QualityMetrics | null
  rawQualityMetrics: QualityMetrics | null
  isProcessed: boolean
  llmCurationScore: number | null
  llmCurationData: LlmCurationData | null
  deduplicationStatus: string
  dedupGroupId: string | null
}

export type DatasetFormat = 'json' | 'csv' | 'txt' | 'md' | 'xml'
export type DatasetStage = 'raw' | 'processed' | 'curated'

export interface Timestamp {
  text: string
  start: number
  duration: number
}

export interface VideoDetails {
  title: string
  channelTitle: string
  duration: number
  thumbnail: string
  viewCount: string
  likeCount: string
}

export interface CreateTranscriptionRequest {
  videoUrl: string
}

export interface CreateTranscriptionResponse {
  message: string
  transcription: Transcription
  videoDetails: VideoDetails
}

export interface UrlTypeInfo {
  icon: React.ComponentType<{ className?: string }>
  label: string
  color: string
}

export type UrlType = 'video' | 'playlist' | 'channel' | 'mixed' | null

export interface TranscribeState {
  input: string
  detectedUrls: string[]
  urlType: UrlType
  bulkMode: boolean
  isProcessing: boolean
  transcriptionJobs: TranscriptionJob[]
}

export interface PlaylistTranscriptionRequest {
  playlistUrl: string
}

export interface PlaylistTranscriptionResponse {
  message: string
  playlist: {
    id: string
    youtubeId: string
    title: string
    videoCount: number
    status: string
    totalDuration: number | null
    totalWordCount: number | null
    createdAt: string
  }
  result: {
    totalVideos: number
    processedVideos: number
    failedVideos: number
    status?: string
  }
}

export interface PlaylistJob {
  id: string
  title: string
  videoCount: number
  status: string
  errorMessage?: string | null
  progress?: number
  totalDuration: number | null
  createdAt: string
  transcriptions?: Array<{
    id: string
    status: string
  }>
}

export interface PlaylistVideoTranscription {
  id: string
  youtubeId: string
  title: string
  status: string
  content: string | null
  thumbnail: string | null
  duration: number | null
  wordCount: number | null
  language: string | null
  timestamps: Timestamp[] | null
  processedContent: string | null
  qualityMetrics: QualityMetrics | null
  isProcessed: boolean
  llmCurationScore: number | null
  llmCurationData: LlmCurationData | null
  errorMessage: string | null
  deduplicationStatus: string
  videoIndex: number | null
  createdAt: string
}

export interface PlaylistDetail {
  id: string
  youtubeId: string
  title: string
  description: string | null
  channelTitle: string | null
  thumbnail: string | null
  videoCount: number
  status: string
  errorMessage: string | null
  totalDuration: number | null
  totalWordCount: number | null
  createdAt: string
  transcriptions: PlaylistVideoTranscription[]
}
