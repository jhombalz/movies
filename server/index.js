import WebTorrent from 'webtorrent'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, basename, resolve } from 'node:path'
import { createStreamingServer } from './app.js'

const publicPlayback=process.env.PUBLIC_PLAYBACK!=='false'
if (!publicPlayback && !process.env.STREAM_API_KEY) throw new Error('Set STREAM_API_KEY when PUBLIC_PLAYBACK=false.')
const downloadPath=await mkdtemp(join(tmpdir(),'frame-movies-'))
if(dirname(downloadPath)!==resolve(tmpdir())||!basename(downloadPath).startsWith('frame-movies-'))throw new Error('Invalid temporary download directory.')
const client=new WebTorrent({utp:false,natUpnp:false,natPmp:false,maxConns:30})
client.on('error',()=>console.error('Torrent client error; check source availability.'))
const server=createStreamingServer({client,downloadPath,apiKey:process.env.STREAM_API_KEY,publicPlayback,allowedOrigins:(process.env.ALLOWED_ORIGINS||'https://jhombalz.github.io,http://127.0.0.1:5173,http://localhost:5173').split(',').map(value=>value.trim()),maxBytes:Number(process.env.MAX_TORRENT_BYTES)||4*1024**3})
server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Frame streaming server is listening.'))
let stopping=false
function shutdown(){
 if(stopping)return;stopping=true
 server.close()
 client.destroy(async()=>{await rm(downloadPath,{recursive:true,force:true});process.exit(0)})
 setTimeout(()=>process.exit(1),10000).unref()
}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown)
