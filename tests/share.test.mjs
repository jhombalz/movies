import test from 'node:test'
import assert from 'node:assert/strict'
import { shareMetadata, createShareLookup } from '../server/share.js'
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
