import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogRequest, recommendedBannerMovie } from '../src/catalog.js'
test('catalog uses the migrated API and retries HTML or failed responses on the fallback',async()=>{
 const urls=[]
 const data=await catalogRequest('list_movies',{minimum_rating:7},{fetcher:async url=>{
  urls.push(url)
  if(url.includes('accel.li'))return{ok:true,json:async()=>{throw Error('HTML error page')}}
  return{ok:true,json:async()=>({status:'ok',data:{movies:[],movie_count:0}})}
 }})
 assert.equal(urls.length,2);assert.match(urls[0],/movies-api\.accel\.li/);assert.match(urls[1],/minimum_rating=7/);assert.equal(data.movie_count,0)
})
test('cancelled catalog requests never start fallback requests',async()=>{
 const controller=new AbortController();let calls=0
 await assert.rejects(catalogRequest('list_movies',{}, {signal:controller.signal,fetcher:async()=>{calls++;controller.abort();throw Error('Cancelled')}}))
 assert.equal(calls,1)
})
test('banner requires rating 7+, recent release year and selected language',()=>{
 const movie={rating:7,year:2026,language:'en'}
 assert.equal(recommendedBannerMovie(movie,'en',2026),true)
 for(const override of [{rating:6.9},{year:2027},{year:2023},{language:'fr'}])assert.equal(recommendedBannerMovie({...movie,...override},'en',2026),false)
 assert.equal(recommendedBannerMovie({...movie,language:'fr'},'',2026),true)
})
