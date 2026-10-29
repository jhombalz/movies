export function vidsrcEmbedUrl(imdbId){
 if(!/^tt\d{5,12}$/.test(String(imdbId||'')))return ''
 return 'https://vidsrc.mov/embed/movie/'+imdbId
}
export const embeddedPlayers=[{id:'vidsrc',name:'VidSrc',number:2},{id:'vidfast',name:'VidFast',number:3},{id:'vidlink',name:'VidLink',number:4}]
export function playerEmbedUrl(provider,movie){
 if(provider==='vidsrc')return vidsrcEmbedUrl(movie.imdb_code)
 if(provider==='vidfast')return /^tt\d{5,12}$/.test(String(movie.imdb_code||''))?'https://vidfast.to/embed/movie/'+movie.imdb_code:''
 if(provider==='vidlink'){
  const id=Number(movie.tmdb_id)
  return Number.isSafeInteger(id)&&id>0?'https://vidlink.pro/movie/'+id:''
 }
 return ''
}
