import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBanner } from '../src/banner.js'
import { recommendedBannerMovie } from '../src/catalog.js'
test('banner shuffles eligible movies without mutation and prioritizes known US productions',async()=>{
 const list=[{id:1,country:'United Kingdom'},{id:2,country:'United States, Canada'},{id:3,production_countries:[{iso_3166_1:'US'}]},{id:4,country:'France'}]
 const first=await randomBanner(list,{random:()=>0}),second=await randomBanner(list,{random:()=>.99})
 assert.deepEqual(first.slice(0,2).map(m=>m.id),[2,3]);assert.deepEqual(second.slice(0,2).map(m=>m.id),[2,3])
 assert.notDeepEqual(first.map(m=>m.id),second.map(m=>m.id));assert.deepEqual(list.map(m=>m.id),[1,2,3,4])
})
test('optional country lookup prioritizes US movies and survives metadata failures',async()=>{
 const result=await randomBanner([{id:1,imdb_code:'tt1234567'},{id:2,imdb_code:'tt7654321'}],{random:()=>.99,fetcher:async url=>{
  if(url.includes('tt1234567'))throw Error('Unavailable')
  return{ok:true,json:async()=>({meta:{country:'USA'}})}
 }})
 assert.deepEqual(result.map(m=>m.id),[2,1])
})
test('US-first productions rank ahead of international co-productions',async()=>{
 const result=await randomBanner([{id:1,country:'France'},{id:2,country:'United Kingdom, United States'},{id:3,country:'United States, Canada'}],{random:()=>.99})
 assert.deepEqual(result.map(m=>m.id),[3,2,1])
})
test('banner excludes documentaries, quiz shows and short films while keeping narrative features',()=>{
 const base={rating:8,year:2026,language:'en',runtime:100}
 for(const genres of [['Documentary'],['Game-Show'],['Short'],['Talk-Show']])assert.equal(recommendedBannerMovie({...base,genres},'en',2026),false)
 assert.equal(recommendedBannerMovie({...base,runtime:20},'en',2026),false)
 assert.equal(recommendedBannerMovie({...base,genres:['Action','Drama']},'en',2026),true)
})
