// Shared by the browser catalog and server-side share previews.
const bases=['https://movies-api.accel.li/api/v2/','https://yts.gg/api/v2/']
export async function catalogRequest(endpoint,params={}, {signal,fetcher=fetch}={}){
 if(!['list_movies','movie_details','movie_suggestions'].includes(endpoint))throw Error('Invalid catalog endpoint')
 for(const base of bases){
  if(signal?.aborted)throw signal.reason||new Error('Cancelled')
  try{
   const response=await fetcher(base+endpoint+'.json?'+new URLSearchParams(params),{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000)})
   if(!response.ok)throw Error('Catalog unavailable')
   const result=await response.json()
   if(result.status!=='ok'||!result.data||typeof result.data!=='object')throw Error('Invalid catalog response')
   return result.data
  }catch(e){if(signal?.aborted)throw e}
 }
 throw Error('The movie catalog is unavailable. Please try again shortly.')
}
export function recommendedBannerMovie(movie,language,year=new Date().getFullYear()){
 return Number(movie.rating)>=7&&Number(movie.year)<=year&&Number(movie.year)>=year-2&&(!language||movie.language===language)
}
export function matchesSavedSearch(movie,query){
 const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()
 const term=normalize(query)
 if(!term)return true
 return [movie.title,movie.title_english,movie.title_long,movie.original_title,movie.slug,movie.imdb_code,...(Array.isArray(movie.aliases)?movie.aliases:[])].some(title=>normalize(title).includes(term))
}
