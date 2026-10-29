import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { ref, computed, nextTick } from 'vue'
import parseTorrent from 'parse-torrent'
import { streamingBase } from '../src/backend.js'
import { serverList } from '../src/servers.js'
import { catalogRequest, recommendedBannerMovie } from '../src/catalog.js'

const appScript=readFileSync(new URL('../src/App.vue',import.meta.url),'utf8').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'')
function storage(){const data=new Map();return{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}}
function app(options={}){
 const context=vm.createContext({ref,computed,nextTick,API_URL:'https://frame-movies.onrender.com',API_URLS:options.servers||['https://frame-movies.onrender.com'],serverList,catalogRequest,recommendedBannerMovie,onMounted(){},onUnmounted(){},localStorage:storage(),sessionStorage:options.sessionStorage||storage(),location:{hash:''},window:{scrollTo(){}},document:{querySelector(){return null}},URL,URLSearchParams,AbortController,AbortSignal,setTimeout,clearTimeout,fetch:options.fetch||(()=>{throw new Error('Unexpected network request')}),loadWebTorrent:options.loadWebTorrent,registerPlayerWorker:async()=>({active:{state:'activated'}}),streamingBase,serverRequest:options.serverRequest,releaseSession:options.releaseSession||(()=>Promise.resolve())})
 vm.runInContext(appScript.replace('const backendEnabled=false',`const backendEnabled=${options.backendEnabled??true}`)+'\nplaybackMode.value="webtorrent";globalThis.api={open,route,close,watch,selected,detailRoute,detailsError,playing,status,stop,magnet,playbackMode,backendUrl,source,load,loadFeatured,movies,sort,rating,latestMovies,bannerLanguage};',context)
 return {context,...context.api}
}
test('recently added is default; random picks enforce 7+ independently of the rating dropdown',async()=>{
 const page=app({fetch:async url=>{
  const params=new URL(url).searchParams
  assert.equal(params.get('minimum_rating'),'7')
  return{ok:true,json:async()=>({status:'ok',data:{movie_count:2,movies:[{id:1,title:'Low',rating:6},{id:2,title:'High',rating:8}]}})}
 }})
 assert.equal(page.sort.value,'date_added');page.sort.value='random';page.rating.value='';await page.load()
 assert.deepEqual(Array.from(page.movies.value,m=>m.id),[2])
})
test('banner feed stays independent of library changes and rejects low-rated or future movies',async()=>{
 const year=new Date().getFullYear()
 const page=app({fetch:async()=>({ok:true,json:async()=>({status:'ok',data:{movies:[{id:1,title:'Good',rating:8,year,language:'en'},{id:2,title:'Low',rating:6,year,language:'en'},{id:3,title:'Future',rating:8,year:year+1,language:'en'}]}})})})
 await page.loadFeatured();assert.deepEqual(Array.from(page.latestMovies.value,m=>m.id),[1])
 page.movies.value=[];page.sort.value='rating';assert.equal(page.latestMovies.value[0].id,1)
})
test('playback falls back to a second server after the primary returns 503',async()=>{
 const attempts=[],id='a'.repeat(48)
 const page=app({servers:['https://frame-movies.onrender.com','https://backup.example'],serverRequest:async(base,path)=>{
  if(path==='/api/play'){
   attempts.push(base)
   if(base.includes('frame-movies')){const error=new Error('Unavailable');error.status=503;throw error}
   return{id}
  }
  return{ready:true}
 }})
 page.playbackMode.value='server';page.open({id:42,title:'Movie',torrents:[{quality:'720p',hash:'a'.repeat(40)}]})
 await page.watch();assert.deepEqual(attempts,['https://frame-movies.onrender.com','https://backup.example']);assert.equal(page.source.value,`https://backup.example/api/sessions/${id}/video`);page.close()
})
test('movie details prefer 720p and block high-quality server playback',async()=>{
 const page=app({serverRequest:async()=>{throw Error('High quality must not reach the server')}})
 page.open({id:42,title:'Movie',torrents:[{quality:'1080p',hash:'a'.repeat(40)},{quality:'720p',hash:'b'.repeat(40)}]})
 assert.equal(vm.runInContext('quality.value',page.context),1)
 page.playbackMode.value='server';vm.runInContext('quality.value=0',page.context);await page.watch();assert.match(page.status.value,/limited to 720p/);page.close()
 const onlyHigh=app();onlyHigh.open({id:43,title:'Movie',torrents:[{quality:'2160p'}]});assert.equal(vm.runInContext('quality.value',onlyHigh.context),-1)
})

test('movie pages have URLs, survive refresh, and support back/forward',async()=>{
 const sessionStorage=storage();const first=app({sessionStorage})
 first.open({id:42,title:'A movie',torrents:[]});await nextTick()
 assert.equal(first.context.location.hash,'#/movie/42?title=A-movie')
 assert.equal(first.selected.value.title,'A movie')
 const refreshed=app({sessionStorage});refreshed.context.location.hash='#/movie/42?title=A%20movie';await refreshed.route()
 assert.equal(refreshed.selected.value.title,'A movie')
 refreshed.context.location.hash='';await refreshed.route();assert.equal(refreshed.detailRoute.value,false)
 refreshed.context.location.hash='#/movie/42';await refreshed.route();assert.equal(refreshed.selected.value.id,42)
 refreshed.close();assert.equal(refreshed.context.location.hash,'');assert.equal(refreshed.selected.value,null)
})

test('direct links retrieve uncached movie details; failed requests remain on the detail page',async()=>{
 const page=app({fetch:async url=>{assert.match(url,/movie_details.json\?movie_id=123/);return{ok:true,json:async()=>({status:'ok',data:{movie:{id:123,title:'Direct link'}}})}}})
 page.context.location.hash='#/movie/123';await page.route();assert.equal(page.selected.value.title,'Direct link')
 const failed=app({fetch:async()=>{throw new Error('Offline')}});failed.context.location.hash='#/movie/999';await failed.route()
 assert.equal(failed.detailRoute.value,true);assert.match(failed.detailsError.value,/catalog is unavailable/)
})

test('torrent playback constructs the imported class and navigation destroys it',async()=>{
 let initialized=false,destroyed=false
 class WebTorrent{constructor(){initialized=true}on(){}createServer(){}add(){}destroy(){destroyed=true;this.destroyed=true}}
 const page=app({loadWebTorrent:async()=>WebTorrent});page.open({id:1,title:'Torrent',torrents:[{quality:'720p',hash:'0123456789012345678901234567890123456789'}]})
 await page.watch();assert.equal(initialized,true);assert.equal(page.status.value,'Connecting to movie peers…')
 page.close();assert.equal(destroyed,true);assert.equal(page.playing.value,false)
})

test('leaving while the player loads cancels initialization',async()=>{
 let finish,started,initialized=false
 const loadingStarted=new Promise(resolve=>{started=resolve})
 const page=app({loadWebTorrent:()=>new Promise(resolve=>{finish=resolve;started()})});page.open({id:2,title:'Slow source',torrents:[{quality:'720p',hash:'a'.repeat(40)}]})
 const pending=page.watch();await loadingStarted;page.close();finish(class{constructor(){initialized=true}});await pending
 assert.equal(initialized,false)
})

test('installed browser bundle exports a usable default constructor',async()=>{
 globalThis.self=globalThis
 const {default:WebTorrent}=await import('../node_modules/webtorrent/dist/webtorrent.min.js')
 assert.equal(typeof WebTorrent,'function')
 const client=new WebTorrent({dht:false,tracker:false})
 assert.equal(typeof client.add,'function');client.destroy()
})

test('magnet preserves metadata and announces to multiple secure browser trackers',()=>{
 const page=app();const params=new URL(page.magnet({hash:'a'.repeat(40),url:'https://example.com/movie.torrent'},{title:'A & B'})).searchParams
 assert.equal(params.get('xs'),'https://example.com/movie.torrent')
 assert.equal(params.get('dn'),'A & B')
 assert.equal(params.getAll('tr').length,3)
 assert.ok(params.getAll('tr').every(tr=>tr.startsWith('wss://')))
 const unsafe=new URL(page.magnet({hash:'b'.repeat(40),url:'javascript:alert(1)'},{title:'Movie'})).searchParams
 assert.equal(unsafe.has('xs'),false)
})

test('generated magnet is accepted by WebTorrent torrent parser',async()=>{
 const page=app();const hash='0123456789abcdef0123456789abcdef01234567'
 const link=page.magnet({hash,url:'https://example.com/movie.torrent'},{title:'Movie & more'})
 const parsed=await parseTorrent(link)
 assert.equal(parsed.infoHash,hash)
 assert.equal(parsed.name,'Movie & more')
 assert.equal(parsed.announce.length,3)
 assert.equal(parsed.xs,'https://example.com/movie.torrent')
 assert.throws(()=>page.magnet({hash:'invalid'},{title:'Bad source'}),/invalid torrent hash/)
})

test('player waits for service worker control, even after activation',async()=>{
 const worker={state:'activated',scriptURL:'https://example.com/movies/sw.min.js'}
 const events=new Map()
 const container={controller:null,register:async()=>({active:worker}),addEventListener:(name,callback)=>events.set(name,callback),removeEventListener:name=>events.delete(name)}
 const code=readFileSync(new URL('../src/player.js',import.meta.url),'utf8').replace(/export /g,'').replaceAll('import.meta.env.BASE_URL',"'/movies/'")
 const context=vm.createContext({navigator:{serviceWorker:container},window:{isSecureContext:true},document:{baseURI:'https://example.com/movies/'},URL,setTimeout,clearTimeout})
 vm.runInContext(code+'\nglobalThis.registerWorker=registerPlayerWorker;',context)
 let done=false
 const pending=context.registerWorker().then(()=>{done=true})
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(done,false)
 assert.equal(events.has('controllerchange'),true)
 container.controller=worker;events.get('controllerchange')();await pending
 assert.equal(done,true);assert.equal(events.has('controllerchange'),false)
})

test('server player sends hash, uses a session video URL, and releases on navigation',async()=>{
 const id='a'.repeat(48);let released=false
 const page=app({serverRequest:async(base,path,options)=>{assert.equal(base,'https://frame-movies.onrender.com');if(path==='/api/play'){assert.equal(options.key,undefined);assert.equal(options.body.hash,'b'.repeat(40));return{id}}return{ready:true,peers:3,speed:1024,progress:.2}},releaseSession:async session=>{assert.equal(session.id,id);released=true}})
 page.playbackMode.value='server'
 page.open({id:3,title:'Server movie',torrents:[{quality:'720p',hash:'b'.repeat(40)}]});await page.watch()
 assert.equal(page.source.value,`https://frame-movies.onrender.com/api/sessions/${id}/video`)
 assert.ok(!page.source.value.includes('private'))
 page.close();assert.equal(released,true)
})

test('server player explains missing settings instead of loading browser WebTorrent',async()=>{
 const page=app({loadWebTorrent:()=>{throw new Error('Browser player must not run')}})
 page.playbackMode.value='server';page.backendUrl.value='';page.open({id:4,title:'No server',torrents:[{quality:'720p',hash:'c'.repeat(40)}]});await page.watch()
 assert.match(page.status.value,/streaming server is not configured/);page.close()
})


test('Webtor loads on opening movies and stops on navigation without backend requests',async()=>{
 const page=app({backendEnabled:false,serverRequest:async()=>{throw Error('Backend must stay disabled')}})
 page.playbackMode.value='webtor'
 page.open({id:321,title:'Movie',torrents:[{quality:'1080p',hash:'a'.repeat(40)}]})
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(page.playing.value,true)
 assert.match(vm.runInContext('webtorSource.value',page.context),/^magnet:/)
 await vm.runInContext('checkServers()',page.context)
 page.close()
 assert.equal(vm.runInContext('webtorSource.value',page.context),'')
 page.open({id:322,title:'Movie',torrents:[{quality:'720p',hash:'b'.repeat(40)}]})
 page.playbackMode.value='server';await page.watch()
 assert.match(page.status.value,/Backend streaming is disabled/)
 page.close()
})
test('Reload player and quality changes force new Webtor instances',async()=>{
 const page=app({backendEnabled:false});page.playbackMode.value='webtor'
 page.open({id:321,title:'Movie',torrents:[{quality:'720p',hash:'a'.repeat(40)},{quality:'1080p',hash:'b'.repeat(40)}]})
 await new Promise(resolve=>setImmediate(resolve))
 const first=vm.runInContext('webtorVersion.value',page.context)
 await page.watch();assert.equal(vm.runInContext('webtorVersion.value',page.context),first+1)
 vm.runInContext('quality.value=1',page.context);await page.watch(true,false)
 assert.equal(vm.runInContext('webtorVersion.value',page.context),first+2)
 assert.match(vm.runInContext('webtorSource.value',page.context),/bbbbbbbb/)
 page.close()
})


test('quality choices exclude 2160p and prefer 720p, then 1080p',()=>{
 const page=app()
 assert.equal(vm.runInContext("defaultQuality({torrents:[{quality:'2160p'},{quality:'1080p'},{quality:'720p'}]})",page.context),2)
 assert.equal(vm.runInContext("defaultQuality({torrents:[{quality:'2160p'},{quality:'1080p'}]})",page.context),1)
 assert.equal(vm.runInContext("defaultQuality({torrents:[{quality:'2160p'}]})",page.context),-1)
})
