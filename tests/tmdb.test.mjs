import test from 'node:test'
import assert from 'node:assert/strict'
import { createMovieInfo } from '../server/tmdb.js'
test('TMDB resolves IMDb IDs, caches results, and returns normalized reviews without exposing the key',async()=>{
 let calls=0
 const info=createMovieInfo({key:'test-secret',fetcher:async url=>{
  calls++;assert.equal(url.searchParams.get('api_key'),'test-secret')
  return{ok:true,json:async()=>url.pathname.includes('/find/')?{movie_results:[{id:42}]}:{imdb_id:'tt0183076',title:'Movie',genres:[{name:'Animation'}],credits:{cast:[{name:'Actor',character:'Role'}]},reviews:{total_results:1,results:[{id:'review',author:'Writer',content:'Review content',author_details:{rating:8},url:'https://www.themoviedb.org/review/review'}]}}}
 }})
 const [first,second]=await Promise.all([info('tt0183076'),info('tt0183076')]);assert.deepEqual(first,second);assert.equal(calls,2)
 assert.equal(first.movie.reviews[0].rating,8);assert.deepEqual(first.movie.genres,['Animation']);assert.equal(JSON.stringify(first).includes('test-secret'),false)
 await info('tt0183076');assert.equal(calls,2)
})
test('TMDB handles invalid IDs, missing configuration, no matches, and upstream failure',async()=>{
 assert.equal((await createMovieInfo({key:''})('tt0183076')).code,503)
 assert.equal((await createMovieInfo({key:'test'})('../secret')).code,400)
 const empty=createMovieInfo({key:'test',fetcher:async()=>({ok:true,json:async()=>({movie_results:[]})})});assert.equal((await empty('tt0183076')).code,404)
 const fail=createMovieInfo({key:'test',fetcher:async()=>{throw Error('Sensitive upstream failure')}});const result=await fail('tt0183076');assert.equal(result.code,502);assert.equal(result.error.includes('Sensitive'),false)
})
