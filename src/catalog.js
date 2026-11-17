// Shared by the browser catalog and server-side share previews.
const bases=['https://yts.pw/api/v2/','https://movies-api.accel.li/api/v2/']
const cacheTtl=10*60*1000,cacheLimit=100
// Keep separate caches for each transport, including injected test fetchers.
const caches=new WeakMap()
export async function catalogRequest(endpoint,params={}, {signal,fetcher=fetch}={}){
 if(!['list_movies','movie_details','movie_suggestions'].includes(endpoint))throw Error('Invalid catalog endpoint')
 if(signal?.aborted)throw signal.reason||new Error('Cancelled')
 const query=new URLSearchParams(params);query.sort()
 const key=endpoint+'.json?'+query
 let cache=caches.get(fetcher)
 if(!cache){cache=new Map();caches.set(fetcher,cache)}
 for(const [key,entry] of cache)if(entry.expires<=Date.now())cache.delete(key)
 const cached=cache.get(key)
 if(cached)return structuredClone(cached.data)
 for(const base of bases){
  if(signal?.aborted)throw signal.reason||new Error('Cancelled')
  try{
   const response=await fetcher(base+key,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000)})
   if(!response.ok)throw Error('Catalog unavailable')
   const result=await response.json()
   if(result.status!=='ok'||!result.data||typeof result.data!=='object')throw Error('Invalid catalog response')
   if(signal?.aborted)throw signal.reason||new Error('Cancelled')
   cache.set(key,{data:structuredClone(result.data),expires:Date.now()+cacheTtl})
   if(cache.size>cacheLimit)cache.delete(cache.keys().next().value)
   return result.data
  }catch(e){if(signal?.aborted)throw e}
 }
 throw Error('The movie catalog is unavailable. Please try again shortly.')
}
export function recommendedBannerMovie(movie,language,year=new Date().getFullYear()){
 const genres=(movie.genres||[]).map(g=>String(g).toLowerCase())
 const feature=!genres.some(g=>['documentary','short','game-show','talk-show','reality-tv','news','sport'].includes(g))&&(!Number(movie.runtime)||Number(movie.runtime)>=60)
 return feature&&Number(movie.rating)>=7&&Number(movie.year)<=year&&Number(movie.year)>=year-2&&(!language||movie.language===language)
}
export function matchesSavedSearch(movie,query){
 const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()
 const term=normalize(query)
 if(!term)return true
 return [movie.title,movie.title_english,movie.title_long,movie.original_title,movie.slug,movie.imdb_code,...(Array.isArray(movie.aliases)?movie.aliases:[])].some(title=>normalize(title).includes(term))
}
export async function searchCatalog(params,options={}){
 const data=await catalogRequest('list_movies',params,options)
 const query=String(params.query_term||'').trim()
 if(Number(data.movie_count)>0||!query||/^tt\d+$/i.test(query)||Number(params.page||1)!==1)return data
 const {signal,fetcher=fetch}=options
 try{
  if(signal?.aborted)throw signal.reason||Error('Cancelled')
  const response=await fetcher('https://v3-cinemeta.strem.io/catalog/movie/top/search='+encodeURIComponent(query)+'.json',{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000)})
  if(!response.ok)return data
  const result=await response.json()
  const seen=new Set()
  const matches=(Array.isArray(result.metas)?result.metas:[]).filter(meta=>{
   if(!/^tt\d{5,12}$/.test(meta?.id||'')||seen.has(meta.id)||!matchesSavedSearch({title:meta.name},query))return false
   seen.add(meta.id);return true
  }).slice(0,5)
  const resolved=await Promise.all(matches.map(async meta=>{
   try{
    const found=await catalogRequest('list_movies',{...params,query_term:meta.id,page:1},options)
    return (found.movies||[]).filter(movie=>movie.imdb_code===meta.id).map(movie=>({...movie,aliases:[...(Array.isArray(movie.aliases)?movie.aliases:[]),meta.name]}))
   }catch(e){if(signal?.aborted)throw e;return[]}
  }))
  if(signal?.aborted)throw signal.reason||Error('Cancelled')
  const movies=[...new Map(resolved.flat().map(movie=>[movie.id,movie])).values()]
  return movies.length?{...data,movies,movie_count:movies.length}:data
 }catch(e){if(signal?.aborted)throw e;return data}
}
