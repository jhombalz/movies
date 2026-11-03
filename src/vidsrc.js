export function vidsrcEmbedUrl(imdbId){
 if(!/^tt\d{5,12}$/.test(String(imdbId||'')))return ''
 return 'https://vidsrc.mov/embed/movie/'+imdbId
}
export const embeddedPlayers=[{id:'vidsrc',name:'VidSrc',number:2},{id:'vidfast',name:'VidFast',number:3},{id:'vidlink',name:'VidLink',number:4}]
export function playerEmbedUrl(provider,movie){
 if(movie.media_type==='tv'){
  const season=Number(movie.season),episode=Number(movie.episode)
  if(!Number.isInteger(season)||season<0||!Number.isInteger(episode)||episode<1)return ''
  const imdb=/^tt\d{5,12}$/.test(String(movie.imdb_code||''))?movie.imdb_code:''
  const tmdb=Number(movie.tmdb_id),validTmdb=Number.isSafeInteger(tmdb)&&tmdb>0
  const suffix='/'+season+'/'+episode
  if(provider==='vidsrc'&&imdb)return 'https://vidsrc.mov/embed/tv/'+imdb+suffix
  if(provider==='vidfast'&&imdb)return 'https://vidfast.to/embed/tv/'+imdb+suffix
  if(provider==='vidlink'&&validTmdb)return 'https://vidlink.pro/tv/'+tmdb+suffix
  return ''
 }
 if(provider==='vidsrc')return vidsrcEmbedUrl(movie.imdb_code)
 if(provider==='vidfast')return /^tt\d{5,12}$/.test(String(movie.imdb_code||''))?'https://vidfast.to/embed/movie/'+movie.imdb_code:''
 if(provider==='vidlink'){
  const id=Number(movie.tmdb_id)
  return Number.isSafeInteger(id)&&id>0?'https://vidlink.pro/movie/'+id:''
 }
 return ''
}
