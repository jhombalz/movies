const origin='https://v3-cinemeta.strem.io'
export function seriesImage(value){try{const url=new URL(value);return url.protocol==='https:'?url.href:''}catch{return ''}}
async function request(path,{signal,fetcher=fetch}={}){
 const response=await fetcher(origin+path,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)})
 if(!response.ok)throw Error('TV information is unavailable. Please try again.')
 return response.json()
}
export async function seriesCatalog({query='',skip=0,...options}={}){
 const extra='skip='+Math.max(0,skip)+(query.trim()?'&search='+encodeURIComponent(query.trim()):'')
 const data=await request('/catalog/series/top/'+extra+'.json',options)
 if(!Array.isArray(data.metas))throw Error('Invalid TV catalog response.')
 return data.metas.filter(m=>/^tt\d{5,12}$/.test(m?.id||'')&&typeof m.name==='string')
}
export function seriesEpisodes(meta){
 const seen=new Set()
 return (Array.isArray(meta.videos)?meta.videos:[]).flatMap(video=>{
  const season=Number(video.season),episode=Number(video.episode??video.number),key=season+':'+episode
  if(!Number.isInteger(season)||season<0||!Number.isInteger(episode)||episode<1||seen.has(key))return[]
  seen.add(key)
  return[{season,episode,name:String(video.name||'Episode '+episode),description:String(video.description||video.overview||''),released:video.released||video.firstAired||'',thumbnail:seriesImage(video.thumbnail)}]
 }).sort((a,b)=>a.season-b.season||a.episode-b.episode)
}
export function episodeReleased(episode,now=Date.now()){
 const date=Date.parse(episode?.released)
 return Boolean(episode)&&(!Number.isFinite(date)||date<=now)
}
export async function seriesDetails(id,options={}){
 if(!/^tt\d{5,12}$/.test(id))throw Error('Invalid series ID.')
 const data=await request('/meta/series/'+id+'.json',options)
 if(!data.meta||data.meta.id!==id||typeof data.meta.name!=='string')throw Error('This series could not be found.')
 const meta=data.meta,tmdb=Number(meta.moviedb_id)
 return {...meta,imdb_code:id,media_type:'tv',tmdb_id:Number.isSafeInteger(tmdb)&&tmdb>0?tmdb:undefined,episodes:seriesEpisodes(meta)}
}
export function seriesRoute(id,season,episode){
 if(!/^tt\d{5,12}$/.test(id||''))return '#/tv'
 const params=new URLSearchParams()
 if(Number.isInteger(season)&&season>=0&&Number.isInteger(episode)&&episode>0){params.set('season',season);params.set('episode',episode)}
 return '#/tv/'+id+(params.size?'?'+params:'')
}
