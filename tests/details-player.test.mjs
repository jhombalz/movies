import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { ref, computed, nextTick } from 'vue'

const appScript=readFileSync(new URL('../src/App.vue',import.meta.url),'utf8').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'')
function storage(){const data=new Map();return{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}}
function app(options={}){
 const context=vm.createContext({ref,computed,nextTick,onMounted(){},onUnmounted(){},localStorage:storage(),sessionStorage:options.sessionStorage||storage(),location:{hash:''},window:{scrollTo(){}},document:{querySelector(){return null}},URL,URLSearchParams,AbortController,AbortSignal,setTimeout,clearTimeout,fetch:options.fetch||(()=>{throw new Error('Unexpected network request')}),loadWebTorrent:options.loadWebTorrent,registerPlayerWorker:async()=>({active:{state:'activated'}})})
 vm.runInContext(appScript+'\nglobalThis.api={open,route,close,watch,selected,detailRoute,detailsError,playing,status,stop};',context)
 return {context,...context.api}
}

test('movie pages have URLs, survive refresh, and support back/forward',async()=>{
 const sessionStorage=storage();const first=app({sessionStorage})
 first.open({id:42,title:'A movie',torrents:[]});await nextTick()
 assert.equal(first.context.location.hash,'#/movie/42')
 assert.equal(first.selected.value.title,'A movie')
 const refreshed=app({sessionStorage});refreshed.context.location.hash='#/movie/42';await refreshed.route()
 assert.equal(refreshed.selected.value.title,'A movie')
 refreshed.context.location.hash='';await refreshed.route();assert.equal(refreshed.detailRoute.value,false)
 refreshed.context.location.hash='#/movie/42';await refreshed.route();assert.equal(refreshed.selected.value.id,42)
 refreshed.close();assert.equal(refreshed.context.location.hash,'');assert.equal(refreshed.selected.value,null)
})

test('direct links retrieve uncached movie details; failed requests remain on the detail page',async()=>{
 const page=app({fetch:async url=>{assert.match(url,/movie_details.json\?movie_id=123/);return{ok:true,json:async()=>({status:'ok',data:{movie:{id:123,title:'Direct link'}}})}}})
 page.context.location.hash='#/movie/123';await page.route();assert.equal(page.selected.value.title,'Direct link')
 const failed=app({fetch:async()=>{throw new Error('Offline')}});failed.context.location.hash='#/movie/999';await failed.route()
 assert.equal(failed.detailRoute.value,true);assert.equal(failed.detailsError.value,'Offline')
})

test('torrent playback constructs the imported class and navigation destroys it',async()=>{
 let initialized=false,destroyed=false
 class WebTorrent{constructor(){initialized=true}on(){}createServer(){}add(){}destroy(){destroyed=true;this.destroyed=true}}
 const page=app({loadWebTorrent:async()=>WebTorrent});page.open({id:1,title:'Torrent',torrents:[{hash:'0123456789012345678901234567890123456789'}]})
 await page.watch();assert.equal(initialized,true);assert.equal(page.status.value,'Connecting to movie peers…')
 page.close();assert.equal(destroyed,true);assert.equal(page.playing.value,false)
})

test('leaving while the player loads cancels initialization',async()=>{
 let finish,started,initialized=false
 const loadingStarted=new Promise(resolve=>{started=resolve})
 const page=app({loadWebTorrent:()=>new Promise(resolve=>{finish=resolve;started()})});page.open({id:2,title:'Slow source',torrents:[{hash:'a'.repeat(40)}]})
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
