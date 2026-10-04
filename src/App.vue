<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { loadWebTorrent, registerPlayerWorker } from './player.js'
import { streamingBase, serverRequest, releaseSession } from './backend.js'
const samples = [
 {id:'sintel',title:'Sintel',year:2010,rating:7.4,runtime:15,genres:['Animation','Fantasy'],summary:'A young traveler searches for the dragon she befriended in this beautifully crafted open movie from the Blender Foundation.',background_image:'https://media.xiph.org/sintel/sintel-2048-surround.png',stream:'https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4',demo:true,torrents:[{quality:'Original',url:'https://webtorrent.io/torrents/sintel.torrent'}]},
 {id:'bbb',title:'Big Buck Bunny',year:2008,rating:6.5,runtime:10,genres:['Animation','Comedy'],summary:'A gentle giant finds his peaceful afternoon interrupted by three mischievous woodland creatures. An open movie by the Blender Foundation.',stream:'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',demo:true,torrents:[]},
 {id:'tears',title:'Tears of Steel',year:2012,rating:5.5,runtime:12,genres:['Sci-Fi','Action'],summary:'In a future Amsterdam, a team of scientists and soldiers attempts to save the world from destructive robots.',stream:'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',demo:true,torrents:[]}
]
const movies=ref(samples), loading=ref(false), notice=ref(''), query=ref(''), genre=ref(''), rating=ref(''), sort=ref('random'), tab=ref('Discover'), page=ref(1), more=ref(false), selected=ref(null), quality=ref(0), playing=ref(false), video=ref(null), status=ref(''), source=ref(''), localUrl=ref(''), stats=ref(''), saved=ref([])
const detailsLoading=ref(false), detailsError=ref(''), detailRoute=ref(false)
const playbackMode=ref('server'), backendUrl=ref(location.hostname?.endsWith('.onrender.com')?location.origin:'https://frame-movies.onrender.com')
try{localStorage.removeItem('frame-streaming-key')}catch{}
let backendAbort, serverSession, serverPoll, releasePromise=Promise.resolve()
let client, timer, request, detailRequest, session=0
const movieCache=new Map()
try { const data=JSON.parse(localStorage.getItem('frame-watchlist') || '[]'); saved.value=Array.isArray(data)?data:[] } catch {}
const genres=['Action','Adventure','Animation','Comedy','Crime','Documentary','Drama','Fantasy','Horror','Mystery','Romance','Sci-Fi','Thriller']
const visible=computed(()=> (tab.value==='My list'?saved.value:movies.value).filter(m=>(!query.value||m.title.toLowerCase().includes(query.value.toLowerCase()))&&(!genre.value||m.genres?.includes(genre.value))&&(!rating.value||m.rating>=Number(rating.value))))
const heroIndex=ref(0)
const randomPages=new Set()
function shuffled(items){const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result}
const featuredMovies=computed(()=>(movies.value.length?movies.value:samples).slice(0,5))
const activeHeroIndex=computed(()=>heroIndex.value%featuredMovies.value.length)
const hero=computed(()=>featuredMovies.value[activeHeroIndex.value])
let heroGesture=null
function moveHero(direction){heroIndex.value=(activeHeroIndex.value+direction+featuredMovies.value.length)%featuredMovies.value.length}
function startHeroSwipe(event){
 if(event.isPrimary===false||event.button>0||event.target.closest('button,a,input,select'))return
 heroGesture={id:event.pointerId,x:event.clientX,y:event.clientY}
 event.currentTarget.setPointerCapture?.(event.pointerId)
}
function finishHeroSwipe(event){
 if(!heroGesture||heroGesture.id!==event.pointerId)return
 const dx=event.clientX-heroGesture.x,dy=event.clientY-heroGesture.y
 heroGesture=null
 if(Math.abs(dx)>=50&&Math.abs(dx)>Math.abs(dy)*1.25)moveHero(dx<0?1:-1)
}
function safeUrl(value) { try { const u=new URL(value); return ['https:','http:'].includes(u.protocol)?u.href:'' } catch { return '' } }
function savedMovie(m){return saved.value.some(x=>x.id===m.id)}
function toggleSave(m){saved.value=savedMovie(m)?saved.value.filter(x=>x.id!==m.id):[...saved.value,m];try{localStorage.setItem('frame-watchlist',JSON.stringify(saved.value))}catch{notice.value='Your browser could not save the watchlist.'}}
async function load(append=false){
 request?.abort();request=new AbortController();const current=request;loading.value=true;notice.value=''
 if(!append){page.value=1;heroIndex.value=0;randomPages.clear()}
 try{
  async function fetchPage(number){
   const params=new URLSearchParams({limit:24,page:number,sort_by:sort.value==='random'?'date_added':sort.value,order_by:'desc',query_term:query.value,genre:genre.value,minimum_rating:rating.value||'0'})
   const response=await fetch(`https://yts.gg/api/v2/list_movies.json?${params}`,{signal:AbortSignal.any([current.signal,AbortSignal.timeout(12000)])})
   if(!response.ok)throw new Error('Catalog unavailable')
   const result=await response.json();if(result.status!=='ok'||!result.data)throw new Error('Invalid catalog response')
   return result.data
  }
  let data=await fetchPage(sort.value==='random'?1:page.value)
  const totalPages=Math.ceil((data.movie_count||0)/24)
  if(sort.value==='random'&&totalPages){
   const remaining=Array.from({length:totalPages},(_,i)=>i+1).filter(number=>!randomPages.has(number))
   if(!remaining.length){more.value=false;return}
   const picked=remaining[Math.floor(Math.random()*remaining.length)]
   if(picked!==1)data=await fetchPage(picked)
   if(current.signal.aborted)return
   page.value=picked;randomPages.add(picked)
  }
  if(current.signal.aborted)return
  const list=sort.value==='random'?shuffled(data.movies||[]):data.movies||[]
  movies.value=append?[...movies.value,...list.filter(movie=>!movies.value.some(existing=>existing.id===movie.id))]:list
  more.value=sort.value==='random'?randomPages.size<totalPages:page.value*24<(data.movie_count||0)
 }catch(e){if(current.signal.aborted)return; if(!append){movies.value=sort.value==='random'?shuffled(samples):samples;more.value=false}notice.value='The movie catalog is unavailable. Explore the open-movie demo collection or play a file from your device.'}
 finally{if(current===request)loading.value=false}
}
function browse(name){if(detailRoute.value)close();tab.value=name;if(name==='Top rated')sort.value='rating';else sort.value='random';if(name!=='My list')load()}
function shuffleDiscover(){sort.value='random';load()}
function movieRoute(id){return '#/movie/'+encodeURIComponent(id)}
function cacheMovie(m){movieCache.set(String(m.id),m);if(m.id!=='local')try{sessionStorage.setItem('frame-movie-'+m.id,JSON.stringify(m))}catch{}}
function open(m){
 cacheMovie(m)
 if(location.hash===movieRoute(m.id)){stop();selected.value=m;quality.value=0;return}
 location.hash=movieRoute(m.id)
 // Update immediately so local-file playback can attach to the new page.
 route()
}
async function route(){
 const match=location.hash.match(/^#\/movie\/([^/]+)$/)
 if(match&&selected.value&&movieRoute(selected.value.id)===location.hash)return
 detailRequest?.abort();stop();quality.value=0;selected.value=null;detailsError.value='';detailsLoading.value=false;detailRoute.value=Boolean(match)
 if(!match)return
 let id
 try{id=decodeURIComponent(match[1])}catch{detailsError.value='Invalid movie link.';return}
 let movie=movieCache.get(id)||[...movies.value,...saved.value,...samples].find(m=>String(m.id)===id)
 if(!movie&&id!=='local')try{movie=JSON.parse(sessionStorage.getItem('frame-movie-'+id)||'null');if(String(movie?.id)!==id)movie=null}catch{}
 if(movie){selected.value=movie;cacheMovie(movie);window.scrollTo(0,0);await nextTick();document.querySelector('#movie-heading')?.focus();return}
 if(!/^\d+$/.test(id)){detailsError.value=id==='local'?'Choose the local movie file again to play it.':'This movie could not be found.';return}
 detailsLoading.value=true;detailRequest=new AbortController();const current=detailRequest
 try{
  const response=await fetch('https://yts.gg/api/v2/movie_details.json?movie_id='+encodeURIComponent(id),{signal:AbortSignal.any([current.signal,AbortSignal.timeout(12000)])})
  if(!response.ok)throw new Error('Movie details are unavailable.')
  const result=await response.json()
  if(result.status!=='ok'||!result.data?.movie||String(result.data.movie.id)!==id)throw new Error('This movie could not be found.')
  if(current.signal.aborted)return
  selected.value=result.data.movie;cacheMovie(selected.value);window.scrollTo(0,0);await nextTick();document.querySelector('#movie-heading')?.focus()
 }catch(e){if(!current.signal.aborted)detailsError.value=e.message}
 finally{if(current===detailRequest)detailsLoading.value=false}
}
function stop(){session++;clearTimeout(timer);clearTimeout(serverPoll);backendAbort?.abort();if(serverSession){releasePromise=releaseSession(serverSession);serverSession=null}if(video.value){video.value.pause();video.value.removeAttribute('src');video.value.load()}if(client&&!client.destroyed)client.destroy();client=null;playing.value=false;source.value='';stats.value='';if(localUrl.value){URL.revokeObjectURL(localUrl.value);localUrl.value=''}}
function close(){detailRequest?.abort();stop();selected.value=null;detailRoute.value=false;detailsError.value='';detailsLoading.value=false;location.hash='';window.scrollTo(0,0)}
const trackers=['wss://tracker.openwebtorrent.com','wss://tracker.webtorrent.dev','wss://tracker.btorrent.xyz']
function magnet(t,m){const hash=String(t.hash||'').trim();if(!/^(?:[a-f0-9]{40}|[a-z2-7]{32})$/i.test(hash))throw new Error('This movie source has an invalid torrent hash. Try another quality.');const params=new URLSearchParams({dn:m.title});for(const tracker of trackers)params.append('tr',tracker);const metadata=safeUrl(t.url);if(metadata)params.set('xs',metadata);return `magnet:?xt=urn:btih:${hash}&${params}`}
async function watchOnServer(t,token){
 if(!backendUrl.value.trim())throw new Error('The streaming server is not configured.')
 const base=streamingBase(backendUrl.value.trim())
 const hash=t.hash||(selected.value.id==='sintel'?'08ada5a7a6183aae1e09d831df6748d566095a10':'')
 if(!/^[a-f0-9]{40}$/i.test(hash))throw new Error('This source has no valid torrent hash for server playback.')
 status.value='Connecting to streaming server…'
 await releasePromise;if(token!==session)return
 const abort=new AbortController();backendAbort=abort
 const created=await serverRequest(base,'/api/play',{method:'POST',body:{hash},signal:AbortSignal.timeout(90000)})
 if(!/^[a-f0-9]{48}$/.test(created.id))throw new Error('The streaming server returned an invalid playback session.')
 const current={base,id:created.id}
 if(token!==session){await releaseSession(current);return}
 serverSession=current
 const started=Date.now()
 async function poll(){
  if(token!==session)return
  try{
   const info=await serverRequest(base,`/api/sessions/${current.id}`,{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(20000)])})
   if(token!==session)return
   if(info.error)throw new Error(info.error)
   stats.value=`${info.peers||0} server peers · ${Math.round((info.speed||0)/1024)} KB/s · ${Math.round((info.progress||0)*100)}% downloaded`
   if(info.ready&&!source.value){source.value=`${base}/api/sessions/${current.id}/video`;status.value='Server stream ready. Press play in the video controls.'}
   if(!info.ready)status.value=Date.now()-started>30000?'Waiting for torrent metadata. The server is still looking for peers…':'Server is fetching torrent metadata…'
   if(!info.ready&&Date.now()-started>90000)throw new Error('No torrent metadata arrived after 90 seconds. Try another quality or source.')
   serverPoll=setTimeout(poll,2500)
  }catch(e){if(token!==session)return;status.value=`Server playback unavailable: ${e.message}`;stats.value='';releasePromise=releaseSession(current);serverSession=null}
 }
 await poll()
}
async function watch(useTorrent=false){
 stop();const token=session;playing.value=true;status.value='Preparing playback…';await nextTick()
 if(token!==session||!selected.value)return
 if(selected.value.stream&&!useTorrent){source.value=selected.value.stream;status.value=selected.value.id==='sintel'?'Sintel trailer':'Ready to play';return}
 const t=selected.value.torrents?.[quality.value];if(!t){status.value='No playable source is available for this movie.';return}
 try{
  if(playbackMode.value==='server'){await watchOnServer(t,token);return}
  const WebTorrent=await loadWebTorrent()
  if(token!==session)return
  const registration=await registerPlayerWorker()
  if(token!==session)return
  client=new WebTorrent();client.on('error',e=>{if(token===session){clearTimeout(timer);stats.value='';status.value=`Playback unavailable: ${e.message}`}});client.createServer({controller:registration})
  status.value='Connecting to movie peers…'
  const activeTorrent=client.add(t.hash?magnet(t,selected.value):safeUrl(t.url),{announce:trackers},torrent=>{
   if(token!==session)return
   const file=torrent.files.find(f=>/\.(mp4|webm|m4v)$/i.test(f.name));if(!file){status.value='This torrent has no browser-compatible video file.';return}
   try{file.streamTo(video.value);status.value='Buffering movie…'}catch(e){status.value=`Playback unavailable: ${e.message}`;return}
   torrent.on('download',()=>{if(token!==session)return;stats.value=`${torrent.numPeers} peers · ${Math.round(torrent.downloadSpeed/1024)} KB/s · ${Math.round(torrent.progress*100)}% downloaded`})
  })
  activeTorrent?.on('wire',()=>{if(token===session)stats.value=`${activeTorrent.numPeers} connected peers`})
  activeTorrent?.on('warning',()=>{if(token===session&&!(activeTorrent.numPeers>0))stats.value='Some connection attempts failed; trying other trackers…'})
  stats.value='Looking for browser-compatible peers…'
  timer=setTimeout(()=>{
   if(token!==session)return
   if(activeTorrent?.downloaded>0){status.value='Data is arriving, but playback has not started. Press play; if it stays at 0:00, try another quality or download the video.';return}
   if(activeTorrent?.numPeers>0){status.value='Peers connected, but no video data is arriving yet. You can keep waiting or try another quality.';return}
   status.value='No browser-compatible peers connected after 30 seconds. Still searching. Try another quality, or download the torrent and play it with a desktop torrent app.'
  },30000)
 }catch(e){if(token===session)status.value=`Playback unavailable: ${e.message}`}
}
function onPlaying(){status.value='Playing';clearTimeout(timer)}
function videoError(){clearTimeout(serverPoll);backendAbort?.abort();if(serverSession){releasePromise=releaseSession(serverSession);serverSession=null}status.value='Your browser could not play this source. Try another quality or a local MP4 file.'}
function localFile(event){const file=event.target.files[0];if(!file)return;open({id:'local',title:file.name,genres:[],summary:'A movie from your device',torrents:[]});stop();localUrl.value=URL.createObjectURL(file);source.value=localUrl.value;playing.value=true;status.value='Ready to play';event.target.value=''}
onMounted(()=>{load();route();window.addEventListener('hashchange',route)})
onUnmounted(()=>{request?.abort();detailRequest?.abort();stop();window.removeEventListener('hashchange',route)})
</script>

<template>
 <header><a class="brand" href="./" aria-label="Frame home"><span class="brand-icon">▥</span> frame<span class="brand-dot">.</span></a><nav aria-label="Main navigation"><button v-for="name in ['Discover','Top rated','My list']" :key="name" :class="{active:tab===name}" @click="browse(name)">{{name}}</button></nav><label class="local-button">＋ Open a movie<input type="file" accept="video/*" @change="localFile"></label><span class="avatar" title="Your personal cinema">ME</span></header>
 <main v-if="!detailRoute">
 <section v-if="tab==='Discover'&&!query&&!genre&&!rating" class="hero" role="region" aria-roledescription="carousel" aria-label="Featured movies" tabindex="0" @keydown.left.prevent="moveHero(-1)" @keydown.right.prevent="moveHero(1)" @pointerdown="startHeroSwipe" @pointerup="finishHeroSwipe" @pointercancel="heroGesture=null" :style="hero.background_image?{backgroundImage:`linear-gradient(90deg,#101114 5%,#10111499 55%,#10111444),linear-gradient(0deg,#101114,transparent 60%),url('${safeUrl(hero.background_image)}')`}:{}">
  <div class="hero-content" aria-live="polite" aria-atomic="true"><p class="eyebrow"><span></span> YOUR NEXT MOVIE NIGHT</p><h1>{{hero.title}}</h1><div class="meta"><span class="rating">★ {{hero.rating}}</span><span>{{hero.year}}</span><span v-if="hero.runtime">{{hero.runtime}} min</span><span class="quality">{{hero.demo?'OPEN MOVIE':'HD'}}</span></div><p class="summary">{{hero.summary||hero.description_full||'Settle in. Your next great story starts here.'}}</p><p class="tags">{{hero.genres?.join(' · ')}}</p><div class="actions"><button class="primary" @click="open(hero)">▶ Explore movie</button><button class="secondary" @click="toggleSave(hero)">{{savedMovie(hero)?'✓ In my list':'＋ My list'}}</button></div></div><div v-if="featuredMovies.length>1" class="hero-controls"><button class="hero-arrow" aria-label="Previous featured movie" @click="moveHero(-1)">←</button><div class="hero-dots"><button v-for="(movie,i) in featuredMovies" :key="movie.id" :class="{active:i===activeHeroIndex}" :aria-label="`Show featured movie ${i+1}: ${movie.title}`" :aria-current="i===activeHeroIndex?'true':undefined" @click="heroIndex=i"></button></div><button class="hero-arrow" aria-label="Next featured movie" @click="moveHero(1)">→</button><span class="hero-position">{{activeHeroIndex+1}} / {{featuredMovies.length}}</span></div><div class="hero-caption">YOUR SEAT. YOUR SCREEN.<br><strong>Stories worth staying in for.</strong></div>
 </section>
 <section class="library"><div class="section-heading"><div><p class="eyebrow">THE GOOD STUFF, ALL IN ONE PLACE</p><h2>{{tab==='My list'?'Your watchlist':tab==='Top rated'?'Audience favorites':'Find your next favorite'}}<span class="count">{{visible.length}}</span></h2></div><span class="subtle">A little escape, whenever you need it.</span></div>
 <form class="filters" @submit.prevent="load()"><label class="search"><span>⌕</span><input v-model="query" placeholder="Search movies…" aria-label="Search movies by title"><button type="submit" aria-label="Search">→</button></label><select v-model="genre" aria-label="Genre" @change="load()"><option value="">All genres</option><option v-for="g in genres" :key="g">{{g}}</option></select><select v-model="rating" aria-label="Minimum rating" @change="load()"><option value="">Any rating</option><option value="7">7+ rated</option><option value="8">8+ rated</option><option value="9">9+ rated</option></select><select v-model="sort" aria-label="Sort movies" @change="load()"><option value="random">Random picks</option><option value="date_added">Recently added</option><option value="year">Latest releases</option><option value="rating">Highest rated</option><option value="download_count">Popular</option></select><button v-if="tab==='Discover'" class="secondary shuffle-button" type="button" :disabled="loading" @click="shuffleDiscover">↻ Shuffle</button></form>
 <div v-if="notice" class="notice" role="status">{{notice}} <button @click="load()">Retry catalog</button></div><p v-if="loading" class="subtle" role="status">Loading movies…</p>
 <div class="grid"><article v-for="(movie,index) in visible" :key="movie.id" class="card"><button class="poster" :class="`palette-${index%6}`" @click="open(movie)" :aria-label="`View ${movie.title}`"><img v-if="safeUrl(movie.large_cover_image||movie.medium_cover_image)" :src="safeUrl(movie.large_cover_image||movie.medium_cover_image)" :alt="movie.title" loading="lazy" @error="$event.target.style.display='none'"><span class="poster-art"><span class="film-mark">F</span><strong>{{movie.title}}</strong><small>{{movie.genres?.[0]||'MOVIE'}}</small></span><span class="score">★ {{movie.rating}}</span><span class="play-overlay">▶</span></button><button class="save" @click="toggleSave(movie)" :aria-label="`${savedMovie(movie)?'Remove':'Save'} ${movie.title}`">{{savedMovie(movie)?'✓':'＋'}}</button><button class="movie-title" @click="open(movie)">{{movie.title}}</button><p class="card-meta">{{movie.year}} <span>·</span> {{movie.genres?.[0]||'Movie'}}</p></article></div>
 <div v-if="!visible.length&&!loading" class="empty"><h3>{{tab==='My list'?'Make room for movie night.':'No movies found.'}}</h3><p>{{tab==='My list'?'Save a movie with the + button to find it here.':'Try another title, genre, or rating.'}}</p></div><button v-if="more&&tab!=='My list'" class="secondary load-more" :disabled="loading" @click="page++;load(true)">Load more movies</button>
 </section>
 <section class="personal"><span class="personal-icon">✦</span><div><h3>Movie night, made yours.</h3><p>Save your favorites. Bring your own movies. Press play.</p></div><label class="secondary">Open a local movie<input type="file" accept="video/*" @change="localFile"></label></section>
 </main><footer v-if="!detailRoute"><span class="brand">frame<span class="brand-dot">.</span></span><span>Your personal cinema · Made for quiet nights in</span></footer>
 <main v-else class="details-page">
 <a class="back-link" href="#" @click.prevent="close">← Back to movies</a>
 <p v-if="detailsLoading" class="notice" role="status">Loading movie details…</p>
 <div v-else-if="detailsError" class="notice" role="alert">{{detailsError}} <button @click="route">Try again</button></div>
 <section v-else-if="selected" class="movie-details" aria-labelledby="movie-heading">
 <aside class="detail-poster" v-if="selected.id!=='local'"><img v-if="safeUrl(selected.large_cover_image||selected.medium_cover_image)" :src="safeUrl(selected.large_cover_image||selected.medium_cover_image)" :alt="selected.title" @error="$event.target.style.display='none'"><span>{{selected.title}}</span></aside><div class="detail-content"><p class="eyebrow">{{selected.demo?'OPEN MOVIE COLLECTION':'MOVIE DETAILS'}}</p><h1 id="movie-heading" tabindex="-1">{{selected.title}}</h1><div class="meta"><span v-if="selected.rating" class="rating">★ {{selected.rating}}</span><span>{{selected.year}}</span><span v-if="selected.runtime">{{selected.runtime}} min</span><span>{{selected.genres?.join(' · ')}}</span></div><p class="detail-summary">{{selected.description_full||selected.summary||selected.description_short||'No synopsis available.'}}</p><div v-if="selected.torrents?.length" class="quality-picker"><label for="quality">Quality</label><select id="quality" v-model="quality"><option v-for="(t,i) in selected.torrents" :key="i" :value="i">{{t.quality}} {{t.type}} {{t.size?`· ${t.size}`:''}}</option></select></div><div v-if="selected.id!=='local'" class="actions"><button class="primary" @click="watch()">▶ {{selected.id==='sintel'?'Watch trailer':'Watch now'}}</button><button v-if="selected.demo&&selected.torrents?.length" class="secondary" @click="watch(true)">Stream full movie</button><a v-if="safeUrl(selected.torrents?.[quality]?.url)" class="secondary" :href="safeUrl(selected.torrents[quality].url)" target="_blank" rel="noopener noreferrer">↓ Download torrent</a><button class="secondary" @click="toggleSave(selected)">{{savedMovie(selected)?'✓ Saved':'＋ My list'}}</button></div><div v-if="playing" class="player"><video ref="video" :src="source||undefined" controls playsinline @playing="onPlaying" @error="videoError"></video><p role="status">{{status}}</p><small>{{stats}}</small></div><p v-if="selected.torrents?.length" class="playback-note">Playback needs available torrent seeds and a supported video format. Leaving this page stops the stream.</p></div></section>
 </main>
</template>
