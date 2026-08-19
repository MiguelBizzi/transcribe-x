import type {
  ExportFormat,
  PlaylistDetail,
  Timestamp,
  TranscriptionDetail,
} from './types'

export interface TranscriptExportPayload {
  title: string
  youtubeId?: string | null
  content: string
  timestamps?: Timestamp[] | null
  language?: string | null
  duration?: number | null
  wordCount?: number | null
  extra?: Record<string, unknown>
}

const MIME_TYPES: Record<ExportFormat, string> = {
  TXT: 'text/plain;charset=utf-8',
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  JSON: 'application/json;charset=utf-8',
}

export function sanitizeFilename(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)

  return slug || 'transcript'
}

export function resolveTranscriptText(
  content?: string | null,
  timestamps?: Timestamp[] | null,
): string {
  if (content?.trim()) {
    return content.trim()
  }

  if (timestamps?.length) {
    return timestamps
      .map((segment) => segment.text.trim())
      .filter(Boolean)
      .join(' ')
  }

  return ''
}

export function transcriptionToPayload(
  transcription: TranscriptionDetail,
  options?: { useProcessed?: boolean },
): TranscriptExportPayload {
  const useProcessed = Boolean(
    options?.useProcessed && transcription.processedContent?.trim(),
  )

  return {
    title: transcription.title,
    youtubeId: transcription.youtubeId,
    content: useProcessed
      ? transcription.processedContent!.trim()
      : resolveTranscriptText(
          transcription.content,
          transcription.timestamps,
        ),
    timestamps: useProcessed ? null : transcription.timestamps,
    language: transcription.language,
    duration: transcription.duration,
    wordCount: useProcessed
      ? transcription.qualityMetrics?.processedWordCount ??
        transcription.wordCount
      : transcription.wordCount,
    extra: {
      isProcessed: transcription.isProcessed,
      exportSource: useProcessed ? 'processed' : 'raw',
      qualityMetrics: transcription.qualityMetrics,
    },
  }
}

export function playlistToPayload(
  playlist: PlaylistDetail,
  options?: { useProcessed?: boolean },
): TranscriptExportPayload {
  const sections = playlist.transcriptions.map((video, index) => {
    const heading = `${index + 1}. ${video.title}`
    const useProcessed = Boolean(
      options?.useProcessed && video.processedContent?.trim(),
    )
    const body = useProcessed
      ? video.processedContent!.trim()
      : resolveTranscriptText(video.content, video.timestamps)
    return body ? `${heading}\n${body}` : heading
  })

  return {
    title: playlist.title,
    youtubeId: playlist.youtubeId,
    content: sections.join('\n\n'),
    language: null,
    duration: playlist.totalDuration,
    wordCount: playlist.totalWordCount,
    extra: {
      videoCount: playlist.videoCount,
      channelTitle: playlist.channelTitle,
      exportSource: options?.useProcessed ? 'processed' : 'raw',
      videos: playlist.transcriptions.map((video) => {
        const useProcessed = Boolean(
          options?.useProcessed && video.processedContent?.trim(),
        )
        return {
          id: video.id,
          youtubeId: video.youtubeId,
          title: video.title,
          status: video.status,
          content: useProcessed
            ? video.processedContent!.trim()
            : resolveTranscriptText(video.content, video.timestamps),
          timestamps: useProcessed ? null : video.timestamps,
          duration: video.duration,
          wordCount: video.wordCount,
          language: video.language,
          videoIndex: video.videoIndex,
          isProcessed: video.isProcessed,
          qualityMetrics: video.qualityMetrics,
        }
      }),
    },
  }
}

function youtubeUrl(youtubeId?: string | null): string | null {
  if (!youtubeId) return null
  return `https://www.youtube.com/watch?v=${youtubeId}`
}

function buildPlainText(payload: TranscriptExportPayload): string {
  const lines = [payload.title]
  const url = youtubeUrl(payload.youtubeId)

  if (url) {
    lines.push(url)
  }

  lines.push('')
  lines.push(payload.content || 'No transcript content available.')

  return lines.join('\n')
}

function wrapText(text: string, maxChars: number): string[] {
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n')
  const lines: string[] = []

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push('')
      continue
    }

    const words = paragraph.split(/\s+/)
    let current = ''

    for (const word of words) {
      if (word.length > maxChars) {
        if (current) {
          lines.push(current)
          current = ''
        }
        for (let i = 0; i < word.length; i += maxChars) {
          lines.push(word.slice(i, i + maxChars))
        }
        continue
      }

      const next = current ? `${current} ${word}` : word
      if (next.length > maxChars) {
        lines.push(current)
        current = word
      } else {
        current = next
      }
    }

    if (current) {
      lines.push(current)
    }
  }

  return lines
}

function escapePdfText(text: string): string {
  return Array.from(text)
    .map((char) => {
      const code = char.charCodeAt(0)
      if (char === '\\') return '\\\\'
      if (char === '(') return '\\('
      if (char === ')') return '\\)'
      if (code === 9) return ' '
      if (code >= 32 && code <= 126) return char
      if (code < 256) return `\\${code.toString(8).padStart(3, '0')}`
      return '?'
    })
    .join('')
}

function buildPdf(payload: TranscriptExportPayload): Uint8Array {
  const encoder = new TextEncoder()
  const body = buildPlainText(payload)
  const wrapped = wrapText(body, 90)
  const linesPerPage = 50
  const pages: string[][] = []

  for (let i = 0; i < wrapped.length; i += linesPerPage) {
    pages.push(wrapped.slice(i, i + linesPerPage))
  }

  if (pages.length === 0) {
    pages.push([''])
  }

  const objects: string[] = []
  objects[0] = '' // 1-indexed
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = '' // filled after we know page count
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'

  const pageObjectNumbers: number[] = []

  for (const pageLines of pages) {
    const content = [
      'BT',
      '/F1 11 Tf',
      '14 TL',
      '72 720 Td',
      ...pageLines.map(
        (line, index) =>
          `${index === 0 ? '' : 'T*'}(${escapePdfText(line)}) Tj`,
      ),
      'ET',
    ].join('\n')

    const contentObjectNumber = objects.length
    objects.push(
      `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`,
    )

    const pageObjectNumber = objects.length
    pageObjectNumbers.push(pageObjectNumber)
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjectNumber} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
    )
  }

  objects[2] = `<< /Type /Pages /Count ${pageObjectNumbers.length} /Kids [${pageObjectNumbers
    .map((number) => `${number} 0 R`)
    .join(' ')}] >>`

  const parts: Uint8Array[] = []
  const offsets = [0]
  let cursor = 0

  const pushAscii = (value: string) => {
    const bytes = encoder.encode(value)
    parts.push(bytes)
    cursor += bytes.length
  }

  pushAscii('%PDF-1.4\n')

  for (let i = 1; i < objects.length; i++) {
    offsets[i] = cursor
    pushAscii(`${i} 0 obj\n${objects[i]}\nendobj\n`)
  }

  const xrefOffset = cursor
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let i = 1; i < objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }

  pushAscii(xref)
  pushAscii(
    `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  )

  const output = new Uint8Array(cursor)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }

  return output
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff

  for (const byte of data) {
    crc ^= byte
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }

  return (crc ^ 0xffffffff) >>> 0
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true)
}

function buildZip(files: Record<string, string>): Uint8Array {
  const encoder = new TextEncoder()
  const entries = Object.entries(files).map(([name, contents]) => {
    const nameBytes = encoder.encode(name)
    const data = encoder.encode(contents)
    return { name, nameBytes, data, crc: crc32(data) }
  })

  const localSize = entries.reduce(
    (sum, entry) => sum + 30 + entry.nameBytes.length + entry.data.length,
    0,
  )
  const centralSize = entries.reduce(
    (sum, entry) => sum + 46 + entry.nameBytes.length,
    0,
  )
  const output = new Uint8Array(localSize + centralSize + 22)
  const view = new DataView(output.buffer)

  let cursor = 0
  const centralOffsets: number[] = []

  for (const entry of entries) {
    centralOffsets.push(cursor)
    writeUint32(view, cursor, 0x04034b50)
    writeUint16(view, cursor + 4, 20)
    writeUint16(view, cursor + 6, 0x0800)
    writeUint16(view, cursor + 8, 0)
    writeUint16(view, cursor + 10, 0)
    writeUint16(view, cursor + 12, 0)
    writeUint32(view, cursor + 14, entry.crc)
    writeUint32(view, cursor + 18, entry.data.length)
    writeUint32(view, cursor + 22, entry.data.length)
    writeUint16(view, cursor + 26, entry.nameBytes.length)
    writeUint16(view, cursor + 28, 0)
    output.set(entry.nameBytes, cursor + 30)
    output.set(entry.data, cursor + 30 + entry.nameBytes.length)
    cursor += 30 + entry.nameBytes.length + entry.data.length
  }

  const centralStart = cursor

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    writeUint32(view, cursor, 0x02014b50)
    writeUint16(view, cursor + 4, 20)
    writeUint16(view, cursor + 6, 20)
    writeUint16(view, cursor + 8, 0x0800)
    writeUint16(view, cursor + 10, 0)
    writeUint16(view, cursor + 12, 0)
    writeUint16(view, cursor + 14, 0)
    writeUint32(view, cursor + 16, entry.crc)
    writeUint32(view, cursor + 20, entry.data.length)
    writeUint32(view, cursor + 24, entry.data.length)
    writeUint16(view, cursor + 28, entry.nameBytes.length)
    writeUint16(view, cursor + 30, 0)
    writeUint16(view, cursor + 32, 0)
    writeUint16(view, cursor + 34, 0)
    writeUint16(view, cursor + 36, 0)
    writeUint32(view, cursor + 38, 0)
    writeUint32(view, cursor + 42, centralOffsets[i])
    output.set(entry.nameBytes, cursor + 46)
    cursor += 46 + entry.nameBytes.length
  }

  writeUint32(view, cursor, 0x06054b50)
  writeUint16(view, cursor + 4, 0)
  writeUint16(view, cursor + 6, 0)
  writeUint16(view, cursor + 8, entries.length)
  writeUint16(view, cursor + 10, entries.length)
  writeUint32(view, cursor + 12, cursor - centralStart)
  writeUint32(view, cursor + 16, centralStart)
  writeUint16(view, cursor + 20, 0)

  return output
}

function paragraphXml(text: string, bold = false): string {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += 4000) {
    chunks.push(text.slice(i, i + 4000))
  }

  if (chunks.length === 0) {
    chunks.push('')
  }

  const runs = chunks
    .map((chunk) => {
      const style = bold ? '<w:rPr><w:b/></w:rPr>' : ''
      return `<w:r>${style}<w:t xml:space="preserve">${escapeXml(chunk)}</w:t></w:r>`
    })
    .join('')

  return `<w:p>${runs}</w:p>`
}

function buildDocx(payload: TranscriptExportPayload): Uint8Array {
  const url = youtubeUrl(payload.youtubeId)
  const paragraphs = [
    paragraphXml(payload.title, true),
    ...(url ? [paragraphXml(url)] : []),
    paragraphXml(''),
    ...buildPlainText(payload)
      .split('\n')
      .slice(url ? 3 : 2)
      .map((line) => paragraphXml(line)),
  ]

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.join('')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`

  return buildZip({
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    'word/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
    'word/document.xml': documentXml,
  })
}

function buildJson(payload: TranscriptExportPayload): string {
  return JSON.stringify(
    {
      title: payload.title,
      youtubeId: payload.youtubeId ?? null,
      url: youtubeUrl(payload.youtubeId),
      language: payload.language ?? null,
      duration: payload.duration ?? null,
      wordCount: payload.wordCount ?? null,
      content: payload.content,
      timestamps: payload.timestamps ?? [],
      ...payload.extra,
    },
    null,
    2,
  )
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function createTranscriptFile(
  payload: TranscriptExportPayload,
  format: ExportFormat,
): { blob: Blob; filename: string } {
  if (!payload.content) {
    throw new Error('No transcript content available to download')
  }

  const filename = `${sanitizeFilename(payload.title)}.${format.toLowerCase()}`

  switch (format) {
    case 'TXT':
      return {
        filename,
        blob: new Blob([buildPlainText(payload)], { type: MIME_TYPES.TXT }),
      }
    case 'JSON':
      return {
        filename,
        blob: new Blob([buildJson(payload)], { type: MIME_TYPES.JSON }),
      }
    case 'PDF':
      return {
        filename,
        blob: new Blob([new Uint8Array(buildPdf(payload))], {
          type: MIME_TYPES.PDF,
        }),
      }
    case 'DOCX':
      return {
        filename,
        blob: new Blob([new Uint8Array(buildDocx(payload))], {
          type: MIME_TYPES.DOCX,
        }),
      }
    default:
      throw new Error(`Unsupported export format: ${format}`)
  }
}

export function downloadTranscript(
  payload: TranscriptExportPayload,
  format: ExportFormat,
) {
  const { blob, filename } = createTranscriptFile(payload, format)
  triggerDownload(blob, filename)
}
