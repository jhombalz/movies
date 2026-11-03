import test from 'node:test'
import assert from 'node:assert/strict'
import { ref, computed, nextTick } from 'vue'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { seriesEpisodes,episodeReleased,seriesRoute,seriesDetails,seriesCatalog,seriesImage } from '../src/series.js'
import { playerEmbedUrl,embeddedPlayers } from '../src/vidsrc.js'
test('TV embed URLs use series IDs with validated seasons and episodes',()=>{
 const show={media_type:'tv',imdb_code:'tt0944947',tmdb_id:1399,season:2,episode:3}
 assert.equal(playerEmbedUrl('vidsrc',show),'https://vidsrc.mov/embed/tv/tt0944947/2/3')
 assert.equal(playerEmbedUrl('vidfast',show),'https://vidfast.to/embed/tv/tt0944947/2/3')
 assert.equal(playerEmbedUrl('vidlink',show),'https://vidlink.pro/tv/1399/2/3')
 assert.equal(playerEmbedUrl('vidsrc',{...show,episode:0}),'')
 assert.equal(playerEmbedUrl('vidsrc',{...show,season:-1}),'')
 assert.equal(playerEmbedUrl('webtor',show),'')
})
test('episode metadata deduplicates, orders and excludes invalid episode numbers',()=>{
 const rows=seriesEpisodes({videos:[{season:2,episode:1,name:'Later'},{season:1,number:2,name:'Second'},{season:1,episode:1,name:'First'},{season:1,episode:1,name:'Duplicate'},{season:-1,episode:1},{season:1,episode:0},{season:0,episode:1,name:'Special'}]})
 assert.deepEqual(rows.map(e=>[e.season,e.episode]),[[0,1],[1,1],[1,2],[2,1]])
 assert.equal(episodeReleased({released:'2099-01-01'},Date.parse('2026-01-01')),false)
 assert.equal(episodeReleased({released:'2020-01-01'},Date.parse('2026-01-01')),true)
 assert.equal(episodeReleased(undefined),false)
})
test('TV catalog search and details use public metadata and preserve IMDb/TMDB identities',async()=>{
 let path=''
 const list=await seriesCatalog({query:'beef',skip:50,fetcher:async url=>{path=url;return{ok:true,json:async()=>({metas:[{id:'tt14403178',name:'Beef'},{id:'invalid',name:'Invalid'}]})}}})
 assert.equal(list.length,1);assert.match(path,/skip=50&search=beef/)
 const show=await seriesDetails('tt14403178',{fetcher:async()=>({ok:true,json:async()=>({meta:{id:'tt14403178',name:'Beef',moviedb_id:154385,videos:[{season:1,episode:1,name:'First'}]}})})})
 assert.equal(show.imdb_code,'tt14403178');assert.equal(show.tmdb_id,154385);assert.equal(show.media_type,'tv');assert.equal(show.episodes.length,1)
 await assert.rejects(seriesDetails('../movie'),/Invalid series ID/)
 assert.equal(seriesRoute('tt14403178',1,2),'#/tv/tt14403178?season=1&episode=2')
})
const script=readFileSync(new URL('../src/TvSeries.vue',import.meta.url),'utf8').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'')
test('TV details restore episode links, switch providers and advance across seasons',async()=>{
 const context=vm.createContext({ref,computed,nextTick,onMounted(){},onUnmounted(){},AbortController,URLSearchParams,URL,embeddedPlayers,playerEmbedUrl,seriesImage,episodeReleased,seriesRoute,location:{hash:'#/tv/tt0944947?season=1&episode=2'},document:{querySelector(){return null}},seriesDetails:async()=>({id:'tt0944947',name:'Show',media_type:'tv',imdb_code:'tt0944947',tmdb_id:1399,episodes:[{season:0,episode:1},{season:1,episode:1},{season:1,episode:2},{season:2,episode:1}]})})
 vm.runInContext(script+';globalThis.api={route,url,provider,season,episode,nextEpisode,hasNext}',context)
 const api=context.api;await api.route();assert.equal(api.season.value,1);assert.equal(api.episode.value,2);assert.equal(api.provider.value,'vidlink');assert.equal(api.url.value,'https://vidlink.pro/tv/1399/1/2')
 api.provider.value='vidsrc';assert.equal(api.url.value,'https://vidsrc.mov/embed/tv/tt0944947/1/2')
 api.nextEpisode();assert.equal(context.location.hash,'#/tv/tt0944947?season=2&episode=1');await api.route();assert.equal(api.hasNext.value,false)
 context.location.hash='#/tv';await api.route();assert.equal(api.url.value,'')
})
