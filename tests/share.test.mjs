import test from 'node:test'
import assert from 'node:assert/strict'
import { shareMetadata, createShareLookup, sharePage } from '../server/share.js'
import { createStreamingServer } from '../server/app.js'
test('API-only backend responds to health checks and does not host the frontend',async()=>{
 const server=createStreamingServer({client:{},downloadPath:'unused'})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 try{
  const base='http://127.0.0.1:'+server.address().port
  const health=await fetch(base+'/api/health');assert.equal(health.status,200);assert.deepEqual(await health.json(),{ok:true})
  assert.equal((await fetch(base+'/')).status,404)
 }finally{await new Promise(resolve=>server.close(resolve))}
})
test('share preview redirects visitors to the separate frontend and preserves metadata',()=>{
 const html=sharePage({id:42,title:'Movie',large_cover_image:'https://example.com/poster.jpg'},'https://api.example.com/movie/42','https://example.com/movies/')
 assert.match(html,/og:image/);assert.match(html,/location.replace/);assert.match(html,/https:\/\/example.com\/movies\/#\/movie\/42/)
 assert.throws(()=>sharePage({id:42,title:'Movie'},'https://api.example.com','javascript:alert(1)'))
})
test('share metadata includes escaped movie title, description, image and canonical URL',()=>{
 const html=shareMetadata({title:'A "movie" <script>',summary:'Story & more',large_cover_image:'https://example.com/poster.jpg'},'https://frame-movies.onrender.com/movie/42')
 assert.match(html,/og:title/);assert.match(html,/og:image/);assert.match(html,/twitter:image/);assert.match(html,/rel="canonical"/);assert.match(html,/&lt;script&gt;/);assert.equal(html.includes('<script>'),false)
 assert.equal(shareMetadata({title:'Movie',large_cover_image:'javascript:alert(1)'},'https://example.com').includes('og:image'),false)
})
test('share lookup validates IDs and caches movie metadata',async()=>{
 let calls=0
 const lookup=createShareLookup(async()=>{calls++;return{ok:true,json:async()=>({status:'ok',data:{movie:{id:42,title:'Movie'}}})}})
 assert.equal(await lookup('../secret'),null);assert.equal(calls,0)
 assert.equal((await lookup('42')).title,'Movie');await lookup('42');assert.equal(calls,1)
 assert.equal(await lookup('43'),null)
})
