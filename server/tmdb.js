export function createMovieInfo({key=process.env.TMDB_API_KEY,fetcher=fetch}={}){
 const cache=new Map(),pending=new Map()
 async function api(path){
  const url=new URL('https://api.themoviedb.org/3/'+path);url.searchParams.set('api_key',key)
  const response=await fetcher(url,{signal:AbortSignal.timeout(12000)})
  if(!response.ok)throw new Error('TMDB movie information is unavailable right now.')
  return response.json()
 }
 return async function movieInfo(imdb){
  if(!/^tt\d{5,12}$/.test(imdb))return{code:400,error:'Invalid IMDb ID.'}
  if(!key)return{code:503,error:'Movie information is not configured yet.'}
  const existing=cache.get(imdb)
  if(existing&&existing.expires>Date.now())return existing.data
  if(pending.has(imdb))return pending.get(imdb)
  if(pending.size>=12)return{code:503,error:'Movie information is busy. Please try again shortly.'}
  const task=(async()=>{
   try{
    const found=await api('find/'+imdb+'?external_source=imdb_id')
    const id=found.movie_results?.[0]?.id
    if(!Number.isSafeInteger(id))return{code:404,error:'No matching movie was found on TMDB.'}
    const movie=await api('movie/'+id+'?append_to_response=reviews,credits&language=en-US')
    if(movie.imdb_id&&movie.imdb_id!==imdb)return{code:404,error:'No matching movie was found on TMDB.'}
    const data={code:200,movie:{id,title:movie.title,overview:movie.overview,tagline:movie.tagline,runtime:movie.runtime,releaseDate:movie.release_date,genres:(movie.genres||[]).map(g=>g.name),rating:movie.vote_average,votes:movie.vote_count,poster:movie.poster_path?'https://image.tmdb.org/t/p/w500'+movie.poster_path:'',url:'https://www.themoviedb.org/movie/'+id,cast:(movie.credits?.cast||[]).slice(0,8).map(c=>({name:c.name,character:c.character})),reviews:(movie.reviews?.results||[]).slice(0,20).map(r=>({id:r.id,author:r.author,content:r.content,rating:r.author_details?.rating,date:r.created_at,url:/^https:\/\/www\.themoviedb\.org\//.test(r.url||'')?r.url:''})),reviewCount:movie.reviews?.total_results||0}}
    if(cache.size>=200)cache.delete(cache.keys().next().value)
    cache.set(imdb,{expires:Date.now()+30*60*1000,data});return data
   }catch{return{code:502,error:'TMDB movie information is unavailable right now.'}}
  })()
  pending.set(imdb,task)
  try{return await task}finally{pending.delete(imdb)}
 }
}
