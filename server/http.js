import { timingSafeEqual } from 'node:crypto'

export function authorized(header, key) {
  const actual = Buffer.from(header || '')
  const expected = Buffer.from(`Bearer ${key}`)
  return Boolean(key) && actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function parseRange(header, length) {
  if (!header) return { start: 0, end: length - 1, partial: false }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header)
  if (!match || (!match[1] && !match[2])) return null
  let start, end
  if (!match[1]) {
    const suffix = Number(match[2])
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null
    start = Math.max(0, length - suffix); end = length - 1
  } else {
    start = Number(match[1]); end = match[2] ? Number(match[2]) : length - 1
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= length || end < start) return null
    end = Math.min(end, length - 1)
  }
  return { start, end, partial: true }
}

export async function readJson(req) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (Buffer.byteLength(body) > 4096) throw new Error('Request body is too large.')
  }
  return JSON.parse(body)
}

export function identifier(hash) {
  const params = new URLSearchParams()
  for (const tracker of ['udp://tracker.opentrackr.org:1337/announce', 'udp://open.stealth.si:80/announce', 'https://tracker.opentrackr.org:443/announce', 'wss://tracker.openwebtorrent.com', 'wss://tracker.webtorrent.dev']) params.append('tr', tracker)
  if (hash === '08ada5a7a6183aae1e09d831df6748d566095a10') params.set('xs', 'https://webtorrent.io/torrents/sintel.torrent')
  return `magnet:?xt=urn:btih:${hash}&${params}`
}
