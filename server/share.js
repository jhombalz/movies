const escape=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
export function shareMetadata(movie,url){
 const title=escape(movie.title+' | JhoFlix'),description=escape((movie.description_full||movie.summary||'Watch movie details on JhoFlix.').slice(0,300))
 let image='';try{const parsed=new URL(movie.large_cover_image||movie.medium_cover_image);if(parsed.protocol==='https:')image=escape(parsed.href)}catch{}
 return `<title>${title}</title><meta name="description" content="${description}"><meta property="og:type" content="video.movie"><meta property="og:site_name" content="JhoFlix"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${escape(url)}"><link rel="canonical" href="${escape(url)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}">${image?`<meta property="og:image" content="${image}"><meta name="twitter:image" content="${image}">`:''}`
}
export function createShareLookup(fetcher=fetch){
 const cache=new Map()
 return async id=>{
  if(!/^\d{1,10}$/.test(id))return null
  const stored=cache.get(id);if(stored&&stored.expires>Date.now())return stored.movie
  const response=await fetcher('https://yts.gg/api/v2/movie_details.json?movie_id='+id,{signal:AbortSignal.timeout(12000)})
  if(!response.ok)throw Error('Unavailable')
  const data=await response.json();const movie=data.data?.movie
  if(data.status!=='ok'||String(movie?.id)!==id)return null
  if(cache.size>=200)cache.delete(cache.keys().next().value)
  cache.set(id,{movie,expires:Date.now()+3600000});return movie
 }
}
export function sharePage(movie,canonical,frontend){
 const url=new URL(frontend)
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('Invalid frontend URL')
 url.hash='/movie/'+movie.id+'?title='+encodeURIComponent(movie.title)
 const target=url.href
 return `<!doctype html><html><head><meta charset="utf-8">${shareMetadata(movie,canonical)}</head><body><h1>${escape(movie.title)}</h1><a href="${escape(target)}">Open movie on JhoFlix</a><script>location.replace(${JSON.stringify(target).replace(/</g,'\\u003c')})</script></body></html>`
}
