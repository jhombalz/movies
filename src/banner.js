const countryCache=new Map()
function countries(value){return(Array.isArray(value)?value:[value]).flatMap(item=>String(item?.iso_3166_1||item?.name||item||'').split(/[,;]/).map(country=>country.trim())).filter(Boolean)}
function isUS(values){return values.some(value=>/^(US|USA|United States(?: of America)?)$/i.test(value))}
export async function randomBanner(movies,{signal,fetcher=fetch,random=Math.random}={}){
 const pool=[...new Map(movies.map(movie=>[movie.id,movie])).values()]
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
 const candidates=pool.slice(0,24)
 let next=0
 const ranked=[]
 await Promise.all(Array.from({length:Math.min(4,candidates.length)},async()=>{
  while(next<candidates.length){
   if(signal?.aborted)return
   const index=next++,movie=candidates[index]
   let known=countries(movie.production_countries||movie.country)
   const imdb=String(movie.imdb_code||'')
   if(!known.length&&/^tt\d{5,12}$/.test(imdb)){
    if(countryCache.has(imdb))known=countryCache.get(imdb)
    else try{
     const response=await fetcher('https://v3-cinemeta.strem.io/meta/movie/'+imdb+'.json',{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(2500)]):AbortSignal.timeout(2500)})
     if(response.ok){const data=await response.json();known=countries(data.meta?.country);if(known.length){if(countryCache.size>=200)countryCache.delete(countryCache.keys().next().value);countryCache.set(imdb,known)}}
    }catch{ /* Country lookup is optional; retain eligible catalog movies. */ }
   }
   ranked.push({movie,index,priority:isUS(known.slice(0,1))?0:isUS(known)?1:2})
  }
 }))
 if(signal?.aborted)throw signal.reason||Error('Cancelled')
 return ranked.sort((a,b)=>a.priority-b.priority||a.index-b.index).slice(0,10).map(item=>item.movie)
}
