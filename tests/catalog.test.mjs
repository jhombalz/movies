import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogRequest, searchCatalog, recommendedBannerMovie } from '../src/catalog.js'
test('missing English aliases resolve through IMDb while keeping catalog filters',async()=>{
 const result=await searchCatalog({query_term:'time to hunt',page:1,quality:'720p',genre:'Action',minimum_rating:6},{fetcher:async url=>{
  if(url.includes('cinemeta'))return{ok:true,json:async()=>({metas:[{id:'tt11777040',name:'Time to Hunt'},{id:'tt1234567',name:'Unrelated film'}]})}
  const params=new URL(url).searchParams
  assert.equal(params.get('quality'),'720p');assert.equal(params.get('genre'),'Action');assert.equal(params.get('minimum_rating'),'6')
  const movies=params.get('query_term')==='tt11777040'?[{id:16988,title:'Sanyangeui sigan',imdb_code:'tt11777040'}]:[]
  return{ok:true,json:async()=>({status:'ok',data:{movies,movie_count:movies.length}})}
 }})
 assert.equal(result.movie_count,1);assert.equal(result.movies[0].id,16988);assert.deepEqual(result.movies[0].aliases,['Time to Hunt'])
})
test('normal catalog results do not need an external lookup, and lookup failure remains empty',async()=>{
 let calls=0
 const direct=await searchCatalog({query_term:'Known'},{fetcher:async()=>{calls++;return{ok:true,json:async()=>({status:'ok',data:{movie_count:1,movies:[{id:1}]}})}}})
 assert.equal(calls,1);assert.equal(direct.movie_count,1)
 const missing=await searchCatalog({query_term:'Unknown'},{fetcher:async url=>{if(url.includes('cinemeta'))throw Error('Offline');return{ok:true,json:async()=>({status:'ok',data:{movie_count:0}})}}})
 assert.equal(missing.movie_count,0)
})
test('catalog uses yts.pw directly and retries invalid responses on the fallback',async()=>{
 const urls=[]
 const data=await catalogRequest('list_movies',{minimum_rating:7},{fetcher:async url=>{
  urls.push(url)
  if(url.includes('yts.pw'))return{ok:true,json:async()=>{throw Error('HTML error page')}}
  return{ok:true,json:async()=>({status:'ok',data:{movies:[],movie_count:0}})}
 }})
 assert.equal(urls.length,2);assert.match(urls[0],/yts\.pw/);assert.match(urls[1],/movies-api\.accel\.li/);assert.match(urls[1],/minimum_rating=7/);assert.equal(data.movie_count,0)
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

test('catalog caches equivalent queries, isolates filters, and protects cached data from mutation',async()=>{
 let calls=0
 const fetcher=async()=>{calls++;return{ok:true,json:async()=>({status:'ok',data:{movies:[{id:calls}]}})}}
 const first=await catalogRequest('list_movies',{page:1,minimum_rating:7},{fetcher})
 first.movies[0].id=999
 const again=await catalogRequest('list_movies',{minimum_rating:7,page:1},{fetcher})
 assert.equal(calls,1);assert.equal(again.movies[0].id,1)
 await catalogRequest('list_movies',{page:2,minimum_rating:7},{fetcher});assert.equal(calls,2)
 const controller=new AbortController();controller.abort()
 await assert.rejects(catalogRequest('list_movies',{page:1,minimum_rating:7},{fetcher,signal:controller.signal}))
 assert.equal(calls,2)
})
test('catalog cache expires after ten minutes and evicts old entries at its size limit',async t=>{
 let clock=1000,calls=0
 t.mock.method(Date,'now',()=>clock)
 const fetcher=async()=>{calls++;return{ok:true,json:async()=>({status:'ok',data:{movie_count:0}})}}
 await catalogRequest('list_movies',{page:1},{fetcher})
 clock+=599999;await catalogRequest('list_movies',{page:1},{fetcher});assert.equal(calls,1)
 clock++;await catalogRequest('list_movies',{page:1},{fetcher});assert.equal(calls,2)
 for(let page=2;page<=101;page++)await catalogRequest('list_movies',{page},{fetcher})
 await catalogRequest('list_movies',{page:1},{fetcher});assert.equal(calls,103)
})
test('catalog does not cache failed requests and can recover on the next attempt',async()=>{
 let failing=true,calls=0
 const fetcher=async()=>{calls++;return{ok:!failing,json:async()=>({status:'ok',data:{movie_count:1}})}}
 await assert.rejects(catalogRequest('list_movies',{}, {fetcher}));assert.equal(calls,2)
 failing=false
 assert.equal((await catalogRequest('list_movies',{}, {fetcher})).movie_count,1)
 assert.equal(calls,3)
})
