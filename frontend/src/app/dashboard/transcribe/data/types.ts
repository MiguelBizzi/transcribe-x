export interface QualityMetrics {
  originalWordCount: number
  processedWordCount: number
  noiseReductionRate: number
  lexicalDiversity: number
  mtldScore?: number
  mattrScore?: number
  avgSentenceLength: number
  hesitationCount: number
  repetitionCount: number
  timestampMarkersRemoved: number
  detectedLanguage: string
  processingDurationMs: number
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
}

export interface TranscriptionDetail extends Transcription {
  content: string | null
  errorMessage: string | null
  processedContent: string | null
  qualityMetrics: QualityMetrics | null
  isProcessed: boolean
  llmCurationScore: number | null
  llmCurationData: LlmCurationData | null
  deduplicationStatus: string
  dedupGroupId: string | null
}

export type ExportFormat = 'TXT' | 'PDF' | 'DOCX' | 'JSON'

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
  }
}

export interface PlaylistJob {
  id: string
  title: string
  videoCount: number
  status: string
  progress?: number
  totalDuration: number | null
  createdAt: string
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
  totalDuration: number | null
  totalWordCount: number | null
  createdAt: string
  transcriptions: PlaylistVideoTranscription[]
}
