import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { createStreamingServer } from '../server/app.js'
import { parseRange, identifier } from '../server/http.js'
import parseTorrent from 'parse-torrent'
import WebTorrent from 'webtorrent'

test('range parser handles seeking, suffixes, and invalid/multipart ranges',()=>{
 assert.deepEqual(parseRange('bytes=2-5',10),{start:2,end:5,partial:true})
 assert.deepEqual(parseRange('bytes=-3',10),{start:7,end:9,partial:true})
 assert.deepEqual(parseRange('bytes=7-',10),{start:7,end:9,partial:true})
 assert.deepEqual(parseRange('bytes=0-99',10),{start:0,end:9,partial:true})
 for(const input of ['bytes=10-','bytes=8-2','bytes=-0','bytes=0-1,3-4','bytes=-','bytes=9007199254740993-'])assert.equal(parseRange(input,10),null)
})

test('Node torrent identifier has a valid hash and desktop trackers',async()=>{
 const data=await parseTorrent(identifier('a'.repeat(40)))
 assert.equal(data.infoHash,'a'.repeat(40));assert.ok(data.announce.some(url=>url.startsWith('udp://')))
})

test('real Node WebTorrent accepts a hash without crashing its debug conversion',async()=>{
 const client=new WebTorrent({dht:false,tracker:false,utp:false,natUpnp:false,natPmp:false})
 try{
  const torrent=client.add(identifier('a'.repeat(40)),{deselect:true})
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Info hash event timed out')),3000);torrent.once('infoHash',hash=>{clearTimeout(timeout);try{assert.equal(hash,'a'.repeat(40));resolve()}catch(e){reject(e)}});torrent.once('error',error=>{clearTimeout(timeout);reject(error)})})
 }finally{await new Promise(resolve=>client.destroy(resolve))}
})

test('HTTP API authenticates playback, streams byte ranges, and releases sessions',async()=>{
 let removes=0,adds=0
 const content=Buffer.from('0123456789')
 const client={add(){adds++;const torrent=new EventEmitter();Object.assign(torrent,{length:10,numPeers:2,downloadSpeed:1000,progress:.5,destroyed:false,files:[{name:'movie.mp4',length:10,createReadStream:({start,end})=>Readable.from([content.subarray(start,end+1)])}]});setImmediate(()=>torrent.emit('ready'));return torrent},remove(torrent){torrent.destroyed=true;removes++;return Promise.resolve()}}
 const server=createStreamingServer({client,apiKey:'private-test-key',downloadPath:'unused',allowedOrigins:['https://jhombalz.github.io']})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const base=`http://127.0.0.1:${server.address().port}`
 const post=(body,key='private-test-key')=>fetch(base+'/api/play',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body)})
 try{
  assert.equal((await fetch(base+'/health')).status,200)
  assert.equal((await post({hash:'a'.repeat(40)},'wrong')).status,401)
  assert.equal((await post({hash:'invalid'})).status,400)
  assert.equal((await post(null)).status,400)
  assert.equal((await fetch(base+'/health',{headers:{Origin:'null'}})).status,403)
  const created=await post({hash:'a'.repeat(40)});assert.equal(created.status,201)
  const {id}=await created.json();assert.match(id,/^[a-f0-9]{48}$/)
  await new Promise(resolve=>setImmediate(resolve))
  const data=await (await fetch(base+`/api/sessions/${id}`)).json();assert.equal(data.ready,true)
  const cors=await fetch(base+`/api/sessions/${id}`,{headers:{Origin:'https://jhombalz.github.io'}});assert.equal(cors.headers.get('access-control-allow-origin'),'https://jhombalz.github.io')
  const stream=await fetch(base+`/api/sessions/${id}/video`,{headers:{Range:'bytes=2-5'}})
  assert.equal(stream.status,206);assert.equal(stream.headers.get('content-range'),'bytes 2-5/10');assert.equal(await stream.text(),'2345')
  const invalid=await fetch(base+`/api/sessions/${id}/video`,{headers:{Range:'bytes=30-'}});assert.equal(invalid.status,416)
  assert.equal((await post({hash:'b'.repeat(40)})).status,409)
  assert.equal((await fetch(base+`/api/sessions/${id}`,{method:'DELETE'})).status,200)
  assert.equal((await fetch(base+`/api/sessions/${id}`)).status,404)
  assert.equal(adds,1);assert.equal(removes,1)
 }finally{await new Promise(resolve=>server.close(resolve))}
})
