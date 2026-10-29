export function vidsrcEmbedUrl(imdbId){
 if(!/^tt\d{5,12}$/.test(String(imdbId||'')))return ''
 return 'https://vidsrc.mov/embed/movie/'+imdbId
}
