import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { authorized, parseRange, readJson, identifier } from './http.js'

const types = { '.html':'text/html; charset=utf-8', '.js':'application/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.json':'application/json', '.mp4':'video/mp4', '.m4v':'video/mp4', '.webm':'video/webm' }

export function createStreamingServer({ client, apiKey, downloadPath, staticPath = resolve('dist'), allowedOrigins = [], maxBytes = 4 * 1024 ** 3, idleMs = 5 * 60 * 1000 }) {
  const sessions = new Map()
  const hashSessions = new Map()
  function json(res, code, data) { res.writeHead(code, { 'Content-Type':'application/json', 'Cache-Control':'no-store' }); res.end(JSON.stringify(data)) }
  function remove(id) {
    const session = sessions.get(id)
    if (!session) return
    sessions.delete(id); hashSessions.delete(session.hash)
    for (const stream of session.streams) stream.destroy()
    if (!session.torrent.destroyed) client.remove(session.torrent, { destroyStore:true }).catch(() => {})
  }
  const sweep = setInterval(() => { for (const [id,s] of sessions) if (!s.streams.size && Date.now()-s.touched > idleMs) remove(id) }, 30000)
  sweep.unref()
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    const origin = req.headers.origin
    let sameOrigin=false
    try { sameOrigin=Boolean(origin)&&new URL(origin).host===req.headers.host } catch {}
    if (origin && !sameOrigin && !allowedOrigins.includes(origin)) return json(res,403,{error:'This website is not allowed to use this server.'})
    if (origin) { res.setHeader('Access-Control-Allow-Origin',origin); res.setHeader('Vary','Origin') }
    res.setHeader('Access-Control-Allow-Methods','GET,HEAD,POST,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type,Range')
    res.setHeader('Access-Control-Expose-Headers','Content-Range,Accept-Ranges,Content-Length')
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
    let path
    try { path = decodeURIComponent(new URL(req.url,'http://localhost').pathname) } catch { return json(res,400,{error:'Invalid URL.'}) }
    try {
      if (path === '/health' && req.method === 'GET') return json(res,200,{ok:true})
      if (path === '/api/play' && req.method === 'POST') {
        if (!authorized(req.headers.authorization,apiKey)) return json(res,401,{error:'Enter the streaming key from your Render environment settings.'})
        let body
        try { body=await readJson(req) } catch { return json(res,400,{error:'Invalid JSON request.'}) }
        const hash=String(body?.hash||'').trim().toLowerCase()
        if (!/^[a-f0-9]{40}$/.test(hash)) return json(res,400,{error:'A valid 40-character torrent hash is required.'})
        let session=hashSessions.get(hash)
        if (!session) {
          if (sessions.size >= 1) return json(res,409,{error:'Another movie is active. Stop it before starting this one, or wait five minutes for cleanup.'})
          const id=randomBytes(24).toString('hex')
          const torrent=client.add(identifier(hash), { path:downloadPath, deselect:true, destroyStoreOnDestroy:true, strategy:'sequential' })
          session={ id,hash,torrent,touched:Date.now(),file:null,error:null,streams:new Set() }
          sessions.set(id,session);hashSessions.set(hash,session)
          torrent.on('error',()=>{session.error='Torrent connection failed. Try another quality or source.'})
          torrent.on('ready',()=>{
            if (torrent.length > maxBytes) { session.error='This torrent exceeds the server download size limit.'; torrent.destroy({destroyStore:true}); return }
            session.file=torrent.files.filter(file=>/\.(mp4|m4v|webm)$/i.test(file.name)).sort((a,b)=>b.length-a.length)[0]
            if (!session.file) session.error='This torrent has no supported MP4 or WebM video. Try another quality.'
          })
        }
        session.touched=Date.now()
        return json(res,201,{id:session.id})
      }
      const match=path.match(/^\/api\/sessions\/([a-f0-9]{48})(\/video)?$/)
      if (match) {
        const session=sessions.get(match[1])
        if (!session) return json(res,404,{error:'Playback expired. Press Watch now to restart.'})
        session.touched=Date.now()
        if (!match[2] && req.method === 'DELETE') { remove(session.id); return json(res,200,{ok:true}) }
        if (!match[2] && req.method === 'GET') return json(res,200,{ready:Boolean(session.file)&&!session.error,error:session.error,peers:session.torrent.numPeers,speed:session.torrent.downloadSpeed,progress:session.torrent.progress})
        if (match[2] && ['GET','HEAD'].includes(req.method)) {
          if (session.error) return json(res,422,{error:session.error})
          const file=session.file
          if (!file) return json(res,425,{error:'Torrent metadata is not ready yet.'})
          const range=parseRange(req.headers.range,file.length)
          if (!range) { res.setHeader('Content-Range',`bytes */${file.length}`); return json(res,416,{error:'Invalid byte range.'}) }
          res.setHeader('Content-Type',types[extname(file.name).toLowerCase()]||'video/mp4')
          res.setHeader('Accept-Ranges','bytes')
          res.setHeader('Cache-Control','private, no-store')
          res.setHeader('Content-Length',range.end-range.start+1)
          if (range.partial) res.setHeader('Content-Range',`bytes ${range.start}-${range.end}/${file.length}`)
          res.writeHead(range.partial?206:200)
          if (req.method === 'HEAD') return res.end()
          const stream=file.createReadStream({start:range.start,end:range.end})
          session.streams.add(stream)
          const cleanup=()=>{session.streams.delete(stream);session.touched=Date.now();stream.destroy()}
          res.on('close',cleanup);stream.on('error',()=>res.destroy());stream.pipe(res)
          return
        }
        return json(res,405,{error:'Method not allowed.'})
      }
      if (path.startsWith('/api/')) return json(res,404,{error:'Endpoint not found.'})
      if (!['GET','HEAD'].includes(req.method)) return json(res,405,{error:'Method not allowed.'})
      const file=resolve(staticPath,'.'+(path==='/'?'/index.html':path))
      if (!file.startsWith(resolve(staticPath)+sep)) return json(res,403,{error:'Invalid path.'})
      const info=await stat(file).catch(()=>null)
      if (!info?.isFile()) return json(res,404,{error:'File not found.'})
      res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':path==='/'||path==='/index.html'?'no-cache':'public, max-age=3600'})
      if (req.method==='HEAD') return res.end()
      createReadStream(file).on('error',()=>res.destroy()).pipe(res)
    } catch { if (!res.headersSent) json(res,500,{error:'The server could not process playback.'});else res.destroy() }
  })
  server.on('close',()=>{clearInterval(sweep);for(const id of sessions.keys())remove(id)})
  return server
}
