<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { loadWebTorrent, registerPlayerWorker } from './player.js'
import { streamingBase, serverRequest, releaseSession } from './backend.js'
import { API_URL, API_URLS } from './config.js'
import { serverList, serverHealth } from './servers.js'
import { catalogRequest, recommendedBannerMovie } from './catalog.js'
import MovieRecommendations from './MovieRecommendations.vue'
import MovieInformation from './MovieInformation.vue'
import WebtorPlayer from './WebtorPlayer.vue'
import VidSrcPlayer from './VidSrcPlayer.vue'
import { vidsrcEmbedUrl } from './vidsrc.js'
const webtorSource=ref(''),webtorVersion=ref(0)
const vidsrcSource=ref(''),vidsrcVersion=ref(0)
async function selectPlayer(provider){
 if(!['webtor','vidsrc'].includes(provider)||provider===playbackMode.value)return
 playbackMode.value=provider
 await watch(false,false)
}
const backendEnabled=false
const samples = [
 {id:'sintel',title:'Sintel',year:2010,rating:7.4,runtime:15,genres:['Animation','Fantasy'],summary:'A young traveler searches for the dragon she befriended in this beautifully crafted open movie from the Blender Foundation.',background_image:'https://media.xiph.org/sintel/sintel-2048-surround.png',stream:'https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4',demo:true,torrents:[{quality:'Original',url:'https://webtorrent.io/torrents/sintel.torrent'}]},
 {id:'bbb',title:'Big Buck Bunny',year:2008,rating:6.5,runtime:10,genres:['Animation','Comedy'],summary:'A gentle giant finds his peaceful afternoon interrupted by three mischievous woodland creatures. An open movie by the Blender Foundation.',stream:'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',demo:true,torrents:[]},
 {id:'tears',title:'Tears of Steel',year:2012,rating:5.5,runtime:12,genres:['Sci-Fi','Action'],summary:'In a future Amsterdam, a team of scientists and soldiers attempts to save the world from destructive robots.',stream:'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',demo:true,torrents:[]}
]
const movies=ref(samples), loading=ref(false), notice=ref(''), query=ref(''), genre=ref(''), rating=ref(''), sort=ref('date_added'), tab=ref('Discover'), page=ref(1), more=ref(false), selected=ref(null), quality=ref(0), playing=ref(false), video=ref(null), status=ref(''), source=ref(''), localUrl=ref(''), stats=ref(''), saved=ref([])
const detailsLoading=ref(false), detailsError=ref(''), detailRoute=ref(false)
function highQuality(t){const label=String(t?.quality||'');return /\b(?:[248]k|uhd)\b/i.test(label)||Number(label.match(/(\d{3,4})p/i)?.[1]||0)>720}
function allowedQuality(t){return /^(720p|1080p)$/i.test(String(t?.quality||'').trim())}
const qualityOptions=computed(()=>(selected.value?.torrents||[]).map((torrent,index)=>({torrent,index})).filter(({torrent})=>allowedQuality(torrent)))
function defaultQuality(movie){
 const torrents=movie.torrents||[]
 const hd=torrents.findIndex(t=>/^720p$/i.test(String(t.quality).trim()))
 return hd>=0?hd:torrents.findIndex(allowedQuality)
}
const playbackMode=ref('webtor'), backendUrl=ref(typeof API_URL==='string'?API_URL:'http://127.0.0.1:3000')
const servers=ref(typeof serverList==='function'?serverList(typeof API_URLS!=='undefined'?API_URLS:[backendUrl.value]):[{url:backendUrl.value,label:'Server 1',state:'available'}])
const checkingServers=ref(false),serverMessage=ref('')
let healthAbort,healthTimer
const attemptedServers=new Set()
let resumePosition=0,resumePlaying=false
async function checkServers(){
 if(!backendEnabled||checkingServers.value)return
 clearTimeout(healthTimer)
 checkingServers.value=true;healthAbort=new AbortController();const current=healthAbort
 await Promise.all(servers.value.map(async server=>{
  const ok=await serverHealth(server.url,{signal:current.signal})
  if(!current.signal.aborted)server.state=ok?'available':'unavailable'
 }))
 checkingServers.value=false
 if(current.signal.aborted)return
 if(!playing.value&&servers.value.find(s=>s.url===backendUrl.value)?.state==='unavailable'){
  const backup=servers.value.find(s=>s.state==='available');if(backup)backendUrl.value=backup.url
 }
 healthTimer=setTimeout(checkServers,60000)
}
function restorePosition(){
 if(!video.value||!resumePosition)return
 video.value.currentTime=resumePosition;resumePosition=0
 if(resumePlaying)video.value.play().catch(()=>{});resumePlaying=false
}
async function changeServer(event){
 const next=event.target.value;if(next===backendUrl.value)return
 const wasPlaying=playing.value;const position=video.value?.currentTime||0;const autoplay=video.value&&!video.value.paused
 backendUrl.value=next;serverMessage.value=''
 if(wasPlaying){await watch(true);resumePosition=position;resumePlaying=autoplay}
}
try{localStorage.removeItem('frame-streaming-key')}catch{}
let backendAbort, serverSession, serverPoll, releasePromise=Promise.resolve()
let client, timer, request, detailRequest, session=0
const movieCache=new Map()
const homeUrl=location.pathname?.startsWith('/movie/')?'/':'./'
try { const data=JSON.parse(localStorage.getItem('frame-watchlist') || '[]'); saved.value=Array.isArray(data)?data:[] } catch {}
const genres=['Action','Adventure','Animation','Comedy','Crime','Documentary','Drama','Fantasy','Horror','Mystery','Romance','Sci-Fi','Thriller']
const visible=computed(()=> (tab.value==='My list'?saved.value:movies.value).filter(m=>(!query.value||m.title.toLowerCase().includes(query.value.toLowerCase()))&&(!genre.value||m.genres?.includes(genre.value))&&(!rating.value||m.rating>=Number(rating.value))))
const heroIndex=ref(0), heroDirection=ref(1)
const randomPages=new Set()
function shuffled(items){const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result}
const latestMovies=ref([])
const bannerLanguage=ref('en'),bannerLoading=ref(false),bannerNotice=ref('')
let featuredRequest
const featuredMovies=computed(()=>(latestMovies.value.length?latestMovies.value:samples.filter(m=>m.rating>=7)).slice(0,10))
async function loadFeatured(){
 featuredRequest?.abort();featuredRequest=new AbortController();const current=featuredRequest
 bannerLoading.value=true;bannerNotice.value='';latestMovies.value=[];heroIndex.value=0
 try{
  const picks=[];const year=new Date().getFullYear()
  for(let page=1;page<=6&&picks.length<10;page++){
   const data=await catalogRequest('list_movies',{limit:50,page,minimum_rating:7,sort_by:'year',order_by:'desc'},{signal:current.signal,fetcher:fetch})
   const list=data.movies||[]
   for(const movie of list)if(recommendedBannerMovie(movie,bannerLanguage.value,year)&&!picks.some(p=>p.id===movie.id))picks.push(movie)
   if(!list.length||list.every(movie=>Number(movie.year)<year-2))break
  }
  if(!current.signal.aborted){latestMovies.value=picks.slice(0,10);heroIndex.value=0;if(!picks.length)bannerNotice.value='No recent 7+ movies found for this language. Showing an open-movie demo.'}
 }catch{if(!current.signal.aborted)bannerNotice.value='Featured movies are unavailable. Showing an open-movie demo.'}
 finally{if(current===featuredRequest)bannerLoading.value=false}
}
const activeHeroIndex=computed(()=>heroIndex.value%featuredMovies.value.length)
const hero=computed(()=>featuredMovies.value[activeHeroIndex.value])
let heroGesture=null
const heroDragging=ref(false), heroDrag=ref(0)
function moveHero(direction){heroDirection.value=direction;heroIndex.value=(activeHeroIndex.value+direction+featuredMovies.value.length)%featuredMovies.value.length}
function selectHero(index){heroDirection.value=index<activeHeroIndex.value?-1:1;heroIndex.value=index}
function heroArtwork(movie){
 const original=movie.background_image_original!==movie.background_image?movie.background_image_original:''
 return safeUrl(movie.large_screenshot_image1||original||movie.large_cover_image||movie.medium_cover_image||movie.background_image)
}
function startHeroSwipe(event){
 if(event.isPrimary===false||event.button>0||event.target.closest('button,a,input,select'))return
 heroGesture={id:event.pointerId,x:event.clientX,y:event.clientY}
 heroDragging.value=true;heroDrag.value=0
 event.currentTarget.setPointerCapture?.(event.pointerId)
}
function updateHeroSwipe(event){
 if(!heroGesture||heroGesture.id!==event.pointerId)return
 const dx=event.clientX-heroGesture.x,dy=event.clientY-heroGesture.y
 if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>12){cancelHeroSwipe(event);return}
 heroDrag.value=Math.max(-event.currentTarget.clientWidth*.35,Math.min(event.currentTarget.clientWidth*.35,dx))
}
function cancelHeroSwipe(event){
 if(event&&heroGesture&&heroGesture.id!==event.pointerId)return
 if(event&&event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)
 heroGesture=null;heroDragging.value=false;heroDrag.value=0
}
function finishHeroSwipe(event){
 if(!heroGesture||heroGesture.id!==event.pointerId)return
 const dx=event.clientX-heroGesture.x,dy=event.clientY-heroGesture.y
 cancelHeroSwipe(event)
 if(Math.abs(dx)>=50&&Math.abs(dx)>Math.abs(dy)*1.25)moveHero(dx<0?1:-1)
}
function safeUrl(value) { try { const u=new URL(value); return ['https:','http:'].includes(u.protocol)?u.href:'' } catch { return '' } }
function savedMovie(m){return saved.value.some(x=>x.id===m.id)}
function toggleSave(m){saved.value=savedMovie(m)?saved.value.filter(x=>x.id!==m.id):[...saved.value,m];try{localStorage.setItem('frame-watchlist',JSON.stringify(saved.value))}catch{notice.value='Your browser could not save the watchlist.'}}
async function load(append=false){
 request?.abort();request=new AbortController();const current=request;loading.value=true;notice.value=''
 if(!append){page.value=1;randomPages.clear()}
 try{
  async function fetchPage(number){
   return catalogRequest('list_movies',{limit:24,page:number,sort_by:sort.value==='random'?'date_added':sort.value,order_by:'desc',query_term:query.value,genre:genre.value,minimum_rating:sort.value==='random'?Math.max(7,Number(rating.value)||0):rating.value||'0'},{signal:current.signal,fetcher:fetch})
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
  const list=sort.value==='random'?shuffled((data.movies||[]).filter(movie=>Number(movie.rating)>=Math.max(7,Number(rating.value)||0))):data.movies||[]
  movies.value=append?[...movies.value,...list.filter(movie=>!movies.value.some(existing=>existing.id===movie.id))]:list
  more.value=sort.value==='random'?randomPages.size<totalPages:page.value*24<(data.movie_count||0)
 }catch(e){if(current.signal.aborted)return; if(!append){movies.value=sort.value==='random'?shuffled(samples.filter(m=>m.rating>=7)):samples;more.value=false}notice.value='The movie catalog is unavailable. Explore the open-movie demo collection or play a file from your device.'}
 finally{if(current===request)loading.value=false}
}
function browse(name){if(detailRoute.value)close();tab.value=name;if(name==='Top rated')sort.value='rating';else sort.value='date_added';if(name!=='My list')load()}
function shuffleDiscover(){sort.value='random';load()}
const shareStatus=ref(''),shareLink=ref('')
let snackbarTimer
function dismissShare(){clearTimeout(snackbarTimer);shareStatus.value='';shareLink.value=''}
async function shareMovie(){
 if(!/^\d+$/.test(String(selected.value?.id)))return
 dismissShare()
 const url=new URL(movieRoute(selected.value.id,selected.value.title),location.href).href
 try{
  await navigator.clipboard.writeText(url)
  shareStatus.value='Movie link copied!'
  snackbarTimer=setTimeout(dismissShare,4500)
 }catch{
  shareStatus.value='Copy this link to share the movie:';shareLink.value=url
 }
}
function movieRoute(id,title){return '#/movie/'+encodeURIComponent(id)+(title?'?title='+encodeURIComponent(String(title).trim().replace(/\s+/g,'-')):'')}
function cacheMovie(m){movieCache.set(String(m.id),m);if(m.id!=='local')try{sessionStorage.setItem('frame-movie-'+m.id,JSON.stringify(m))}catch{}}
function applyMovieInformation({id,movie}){
 if(!movie||String(selected.value?.id)!==String(id))return
 selected.value={...selected.value,description_full:movie.overview||selected.value.description_full,runtime:movie.runtime||selected.value.runtime,genres:movie.genres?.length?movie.genres:selected.value.genres,large_cover_image:movie.poster||selected.value.large_cover_image}
}
function open(m){
 cacheMovie(m)
 if(location.hash===movieRoute(m.id,m.title)){stop();selected.value=m;quality.value=defaultQuality(m);if(m.id!=='local'&&['webtor','vidsrc'].includes(playbackMode.value))void watch(false,false);return}
 location.hash=movieRoute(m.id,m.title)
 // Update immediately so local-file playback can attach to the new page.
 route()
}
async function route(){
 const match=location.hash.match(/^#\/movie\/([^/?]+)(?:\?.*)?$/)
 if(match&&selected.value&&encodeURIComponent(selected.value.id)===match[1])return
 dismissShare();detailRequest?.abort();stop();quality.value=0;selected.value=null;detailsError.value='';detailsLoading.value=false;detailRoute.value=Boolean(match)
 if(!match)return
 let id
 try{id=decodeURIComponent(match[1])}catch{detailsError.value='Invalid movie link.';return}
 let movie=movieCache.get(id)||[...movies.value,...saved.value,...samples].find(m=>String(m.id)===id)
 if(!movie&&id!=='local')try{movie=JSON.parse(sessionStorage.getItem('frame-movie-'+id)||'null');if(String(movie?.id)!==id)movie=null}catch{}
 if(movie){selected.value=movie;quality.value=defaultQuality(movie);cacheMovie(movie);window.scrollTo(0,0);await nextTick();document.querySelector('#movie-heading')?.focus();if(movie.id!=='local'&&['webtor','vidsrc'].includes(playbackMode.value))await watch(false,false);return}
 if(!/^\d+$/.test(id)){detailsError.value=id==='local'?'Choose the local movie file again to play it.':'This movie could not be found.';return}
 detailsLoading.value=true;detailRequest=new AbortController();const current=detailRequest
 try{
  const data=await catalogRequest('movie_details',{movie_id:id},{signal:current.signal,fetcher:fetch})
  if(!data.movie||String(data.movie.id)!==id)throw new Error('This movie could not be found.')
  if(current.signal.aborted)return
  selected.value=data.movie;quality.value=defaultQuality(selected.value);cacheMovie(selected.value);window.scrollTo(0,0);await nextTick();document.querySelector('#movie-heading')?.focus();if(['webtor','vidsrc'].includes(playbackMode.value))await watch(false,false)
 }catch(e){if(!current.signal.aborted)detailsError.value=e.message}
 finally{if(current===detailRequest)detailsLoading.value=false}
}
function stop(){vidsrcSource.value='';webtorSource.value='';session++;clearTimeout(timer);clearTimeout(serverPoll);backendAbort?.abort();if(serverSession){releasePromise=releaseSession(serverSession);serverSession=null}if(video.value){video.value.pause();video.value.removeAttribute('src');video.value.load()}if(client&&!client.destroyed)client.destroy();client=null;playing.value=false;source.value='';stats.value='';if(localUrl.value){URL.revokeObjectURL(localUrl.value);localUrl.value=''}}
function close(){if(location.pathname?.startsWith('/movie/'))history.replaceState(null,'','/');detailRequest?.abort();stop();selected.value=null;detailRoute.value=false;detailsError.value='';detailsLoading.value=false;location.hash='';window.scrollTo(0,0)}
const trackers=['wss://tracker.openwebtorrent.com','wss://tracker.webtorrent.dev','wss://tracker.btorrent.xyz']
function magnet(t,m){const hash=String(t.hash||'').trim();if(!/^(?:[a-f0-9]{40}|[a-z2-7]{32})$/i.test(hash))throw new Error('This movie source has an invalid torrent hash. Try another quality.');const params=new URLSearchParams({dn:m.title});for(const tracker of trackers)params.append('tr',tracker);const metadata=safeUrl(t.url);if(metadata)params.set('xs',metadata);return `magnet:?xt=urn:btih:${hash}&${params}`}
async function watchOnServer(t,token){
 if(!backendUrl.value.trim())throw new Error('The streaming server is not configured.')
 let base=streamingBase(backendUrl.value.trim())
 const hash=t.hash||(selected.value.id==='sintel'?'08ada5a7a6183aae1e09d831df6748d566095a10':'')
 if(!/^[a-f0-9]{40}$/i.test(hash))throw new Error('This source has no valid torrent hash for server playback.')
 status.value='Connecting to streaming server…'
 await releasePromise;if(token!==session)return
 const abort=new AbortController();backendAbort=abort
 let created,lastError
 const candidates=servers.value.filter(s=>s.state!=='unavailable').map(s=>s.url).sort((a,b)=>(a===base?-1:b===base?1:0))
 for(const candidate of candidates){
  if(attemptedServers.has(candidate))continue
  if(token!==session)return
  attemptedServers.add(candidate)
  try{
   created=await serverRequest(candidate,'/api/play',{method:'POST',body:{hash},signal:AbortSignal.any([abort.signal,AbortSignal.timeout(90000)])})
   if(!/^[a-f0-9]{48}$/.test(created.id))throw new Error('Invalid server response.')
   base=candidate;backendUrl.value=base
   const active=servers.value.find(s=>s.url===base);if(active)active.state='available'
   break
  }catch(e){
   if(token!==session)return
   lastError=e
   if(e.status&&e.status<500&&e.status!==429)throw e
   const failed=servers.value.find(s=>s.url===candidate);if(failed)failed.state='unavailable'
   status.value='Server unavailable. Trying another server…'
  }
 }
 if(!created)throw lastError||new Error('No available streaming servers. Refresh the server list and try again.')
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
  }catch(e){
   if(token!==session)return
   status.value=`Server playback unavailable: ${e.message}`;stats.value=''
   if(typeof serverHealth==='function'&&!(await serverHealth(base,{signal:abort.signal}))){
    if(token!==session)return
    const failed=servers.value.find(s=>s.url===base);if(failed)failed.state='unavailable'
    const backup=servers.value.find(s=>s.state!=='unavailable'&&!attemptedServers.has(s.url))
    if(backup){
     resumePosition=video.value?.currentTime||0;resumePlaying=Boolean(video.value&&!video.value.paused)
     releasePromise=releaseSession(current);serverSession=null;source.value='';backendUrl.value=backup.url
     status.value='Switching to a backup server. The movie will buffer again…'
     try{await watchOnServer(t,token)}catch(error){if(token===session)status.value=error.message}
     return
    }
   }
   if(token!==session)return
   releasePromise=releaseSession(current);serverSession=null
  }
 }
 await poll()
}
async function watch(useTorrent=false,scrollToPlayer=true){
 stop();attemptedServers.clear();resumePosition=0;resumePlaying=false;const token=session;playing.value=true;status.value='Preparing playback…';await nextTick()
 if(token!==session||!selected.value)return
 if(playbackMode.value==='vidsrc'){
  const url=vidsrcEmbedUrl(selected.value.imdb_code)
  if(!url){status.value='Player 2 is unavailable: this movie has no IMDb ID. Use Player 1.';return}
  vidsrcVersion.value++;vidsrcSource.value=url
  status.value='Player 2 - VidSrc. Press play inside the player. Quality and subtitles are controlled there.'
  return
 }
 if(selected.value.stream&&!useTorrent){source.value=selected.value.stream;status.value=selected.value.id==='sintel'?'Sintel trailer':'Ready to play';return}
 const t=selected.value.torrents?.[quality.value];if(!t||!allowedQuality(t)){status.value='No 720p or 1080p source is available for this movie.';return}
 if(playbackMode.value==='server'&&highQuality(t)){status.value='Server playback is limited to 720p or lower. Choose a lower quality.';return}
 try{
  if(playbackMode.value==='webtor'){
   const torrentSource=t.hash?magnet(t,selected.value):safeUrl(t.url)
   if(!torrentSource)throw new Error('This movie has no valid torrent source. Try another quality.')
   webtorVersion.value++;webtorSource.value=torrentSource;status.value='Stream provided by Webtor. Use the player controls to start playback.'
   await nextTick();if(token===session&&scrollToPlayer)document.querySelector('.player')?.scrollIntoView({behavior:'smooth',block:'start'})
   return
  }
  if(playbackMode.value==='server'){if(!backendEnabled)throw new Error('Backend streaming is disabled.');await watchOnServer(t,token);return}
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
onMounted(()=>{if(!location.hash&&/^\/movie\/\d+$/.test(location.pathname||''))location.hash='#'+location.pathname;loadFeatured();load();route();window.addEventListener('hashchange',route)})
onUnmounted(()=>{dismissShare();healthAbort?.abort();clearTimeout(healthTimer);featuredRequest?.abort();request?.abort();detailRequest?.abort();stop();window.removeEventListener('hashchange',route)})
</script>

<template>
 <header><a class="brand" :href="homeUrl" aria-label="JhoFlix home"><span class="brand-icon">▥</span> JhoFlix<span class="brand-dot">.</span></a><nav aria-label="Main navigation"><button v-for="name in ['Discover','Top rated','My list']" :key="name" :class="{active:tab===name}" @click="browse(name)">{{name}}</button></nav><label class="local-button">＋ Open a movie<input type="file" accept="video/*" @change="localFile"></label><span class="avatar" title="Your personal cinema">ME</span></header>
 <main v-if="!detailRoute">
 <section v-if="tab==='Discover'&&!query&&!genre&&!rating" class="hero" :class="{'is-dragging':heroDragging}" role="region" aria-roledescription="carousel" aria-label="Featured movies" tabindex="0" @keydown.left.prevent="moveHero(-1)" @keydown.right.prevent="moveHero(1)" @pointerdown="startHeroSwipe" @pointermove="updateHeroSwipe" @pointerup="finishHeroSwipe" @pointercancel="cancelHeroSwipe" @lostpointercapture="cancelHeroSwipe" @dragstart.prevent :style="{'--hero-direction':heroDirection,'--hero-drag':heroDrag+'px'}">
  <Transition name="hero-art"><div :key="hero.id" class="hero-artwork" :style="{backgroundImage:heroArtwork(hero)?`url('${heroArtwork(hero)}')`:undefined}"></div></Transition>
  <div class="hero-shade"></div><div class="hero-filters"><label for="banner-language">Banner language</label><select id="banner-language" v-model="bannerLanguage" @change="loadFeatured"><option value="">All languages</option><option value="en">English</option><option value="tl">Filipino</option><option value="ko">Korean</option><option value="ja">Japanese</option><option value="fr">French</option><option value="es">Spanish</option><option value="hi">Hindi</option></select><span v-if="bannerLoading" role="status">Loading...</span></div>
  <div class="hero-copy" aria-live="polite" aria-atomic="true"><Transition name="hero-slide" mode="out-in"><div :key="hero.id" class="hero-content"><p class="eyebrow"><span></span> {{hero.demo?'OPEN MOVIE DEMO':'LATEST RELEASES - 7+ RATED'}}</p><h1>{{hero.title}}</h1><div class="meta"><span class="rating">★ {{hero.rating}}</span><span>{{hero.year}}</span><span v-if="hero.runtime">{{hero.runtime}} min</span><span class="quality">{{hero.demo?'OPEN MOVIE':'HD'}}</span></div><p class="summary">{{hero.summary||hero.description_full||'Settle in. Your next great story starts here.'}}</p><p class="tags">{{hero.genres?.join(' · ')}}</p><div class="actions"><button class="primary" @click="open(hero)">▶ Explore movie</button><button class="secondary" @click="toggleSave(hero)">{{savedMovie(hero)?'✓ In my list':'＋ My list'}}</button></div></div></Transition></div><div v-if="featuredMovies.length>1" class="hero-controls"><button class="hero-arrow" aria-label="Previous featured movie" @click="moveHero(-1)">←</button><div class="hero-dots"><button v-for="(movie,i) in featuredMovies" :key="movie.id" :class="{active:i===activeHeroIndex}" :aria-label="`Show featured movie ${i+1}: ${movie.title}`" :aria-current="i===activeHeroIndex?'true':undefined" @click="selectHero(i)"></button></div><button class="hero-arrow" aria-label="Next featured movie" @click="moveHero(1)">→</button><span class="hero-position">{{activeHeroIndex+1}} / {{featuredMovies.length}}</span></div><div class="hero-caption">YOUR SEAT. YOUR SCREEN.<br><strong>Stories worth staying in for.</strong></div>
 </section>
 <p v-if="bannerNotice" class="banner-notice subtle" role="status">{{bannerNotice}}</p>
 <section class="library"><div class="section-heading"><div><p class="eyebrow">THE GOOD STUFF, ALL IN ONE PLACE</p><h2>{{tab==='My list'?'Your watchlist':tab==='Top rated'?'Audience favorites':'Find your next favorite'}}<span class="count">{{visible.length}}</span></h2></div><span class="subtle">A little escape, whenever you need it.</span></div>
 <form class="filters" @submit.prevent="load()"><label class="search"><span>⌕</span><input v-model="query" placeholder="Search movies…" aria-label="Search movies by title"><button type="submit" aria-label="Search">→</button></label><select v-model="genre" aria-label="Genre" @change="load()"><option value="">All genres</option><option v-for="g in genres" :key="g">{{g}}</option></select><select v-model="rating" aria-label="Minimum rating" @change="load()"><option value="">Any rating</option><option value="7">7+ rated</option><option value="8">8+ rated</option><option value="9">9+ rated</option></select><select v-model="sort" aria-label="Sort movies" @change="load()"><option value="random">Random picks (7+)</option><option value="date_added">Recently added</option><option value="year">Latest releases</option><option value="rating">Highest rated</option><option value="download_count">Popular</option></select><button v-if="tab==='Discover'" class="secondary shuffle-button" type="button" :disabled="loading" @click="shuffleDiscover">↻ Shuffle</button></form>
 <div v-if="notice" class="notice" role="status">{{notice}} <button @click="load()">Retry catalog</button></div><p v-if="loading" class="subtle" role="status">Loading movies…</p>
 <div class="grid"><article v-for="(movie,index) in visible" :key="movie.id" class="card"><button class="poster" :class="`palette-${index%6}`" @click="open(movie)" :aria-label="`View ${movie.title}`"><img v-if="safeUrl(movie.large_cover_image||movie.medium_cover_image)" :src="safeUrl(movie.large_cover_image||movie.medium_cover_image)" :alt="movie.title" loading="lazy" @error="$event.target.style.display='none'"><span class="poster-art"><span class="film-mark">F</span><strong>{{movie.title}}</strong><small>{{movie.genres?.[0]||'MOVIE'}}</small></span><span class="score">★ {{movie.rating}}</span><span class="play-overlay">▶</span></button><button class="save" @click="toggleSave(movie)" :aria-label="`${savedMovie(movie)?'Remove':'Save'} ${movie.title}`">{{savedMovie(movie)?'✓':'＋'}}</button><button class="movie-title" @click="open(movie)">{{movie.title}}</button><p class="card-meta">{{movie.year}} <span>·</span> {{movie.genres?.[0]||'Movie'}}</p></article></div>
 <div v-if="!visible.length&&!loading" class="empty"><h3>{{tab==='My list'?'Make room for movie night.':'No movies found.'}}</h3><p>{{tab==='My list'?'Save a movie with the + button to find it here.':'Try another title, genre, or rating.'}}</p></div><button v-if="more&&tab!=='My list'" class="secondary load-more" :disabled="loading" @click="page++;load(true)">Load more movies</button>
 </section>
 <section class="personal"><span class="personal-icon">✦</span><div><h3>Movie night, made yours.</h3><p>Save your favorites. Bring your own movies. Press play.</p></div><label class="secondary">Open a local movie<input type="file" accept="video/*" @change="localFile"></label></section>
 </main><footer v-if="!detailRoute"><span class="brand">JhoFlix<span class="brand-dot">.</span></span><span>Your personal cinema · Made for quiet nights in</span></footer>
 <main v-else class="details-page">
 <a class="back-link" href="#" @click.prevent="close">← Back to movies</a>
 <p v-if="detailsLoading" class="notice" role="status">Loading movie details…</p>
 <div v-else-if="detailsError" class="notice" role="alert">{{detailsError}} <button @click="route">Try again</button></div>
 <section v-else-if="selected" class="movie-details" aria-labelledby="movie-heading">
 <aside class="detail-poster" v-if="selected.id!=='local'"><img v-if="safeUrl(selected.large_cover_image||selected.medium_cover_image)" :src="safeUrl(selected.large_cover_image||selected.medium_cover_image)" :alt="selected.title" @error="$event.target.style.display='none'"><span>{{selected.title}}</span></aside><div class="detail-content"><p class="eyebrow">{{selected.demo?'OPEN MOVIE COLLECTION':'MOVIE DETAILS'}}</p><h1 id="movie-heading" tabindex="-1">{{selected.title}}</h1><div class="meta"><span v-if="selected.rating" class="rating">★ {{selected.rating}}</span><span>{{selected.year}}</span><span v-if="selected.runtime">{{selected.runtime}} min</span><span>{{selected.genres?.join(' · ')}}</span></div><p class="detail-summary">{{selected.description_full||selected.summary||selected.description_short||'No synopsis available.'}}</p><div v-if="selected.id!=='local'" class="player-tabs" role="group" aria-label="Playback provider"><button :class="{active:playbackMode==='webtor'}" :aria-pressed="playbackMode==='webtor'" @click="selectPlayer('webtor')">Player 1 <span>Webtor</span></button><button :class="{active:playbackMode==='vidsrc'}" :aria-pressed="playbackMode==='vidsrc'" :disabled="!/^tt\d{5,12}$/.test(selected.imdb_code||'')" @click="selectPlayer('vidsrc')">Player 2 <span>VidSrc</span></button></div><p v-if="playbackMode==='vidsrc'" class="subtle">Player 2 uses its own sources. Choose quality inside the player.</p><div v-if="selected.torrents?.length&&playbackMode!=='vidsrc'" class="quality-picker"><label for="quality">Quality</label><select id="quality" v-model="quality" @change="watch(true,false)"><option v-if="quality<0" :value="-1" disabled>No 720p or 1080p source available</option><option v-for="{torrent:t,index:i} in qualityOptions" :key="i" :value="i" :disabled="playbackMode==='server'&&highQuality(t)">{{t.quality}} {{t.type}} {{playbackMode==='server'&&highQuality(t)?'(disabled)':''}} {{t.size?`· ${t.size}`:''}}</option></select></div><div v-if="selected.torrents?.length&&playbackMode==='server'" class="server-picker"><label for="stream-server">Streaming server</label><select id="stream-server" :value="backendUrl" @change="changeServer"><option v-for="server in servers" :key="server.url" :value="server.url" :disabled="server.state!=='available'">{{server.label}} ? {{server.state==='available'?'Available':server.state==='checking'?'Checking?':'Unavailable'}}</option></select><button class="secondary" :disabled="checkingServers" @click="checkServers">{{checkingServers?'Checking?':'Refresh servers'}}</button><span class="subtle">Unavailable servers are disabled. Switching servers buffers the movie again.</span></div><div v-if="selected.id!=='local'" class="actions"><button class="primary" @click="watch()">▶ {{selected.id==='sintel'?'Reload trailer':'Reload player'}}</button><button v-if="selected.demo&&selected.torrents?.length" class="secondary" @click="watch(true)">Stream full movie</button><a v-if="safeUrl(selected.torrents?.[quality]?.url)" class="secondary" :href="safeUrl(selected.torrents[quality].url)" target="_blank" rel="noopener noreferrer">↓ Download torrent</a><button v-if="/^\d+$/.test(String(selected.id))" class="secondary" @click="shareMovie">Share movie</button><button class="secondary" @click="toggleSave(selected)">{{savedMovie(selected)?'✓ Saved':'＋ My list'}}</button></div><details v-if="selected.id!=='local'" class="watch-guide"><summary>How to watch</summary><ol><li>If an ad covers the player, wait for the countdown, then click Close in the top-right corner. Close any ad popups or new tabs and return to this movie page.</li><li>The player loads when you open a movie. Press play inside it if playback does not start automatically.</li><li>In Player 1, choose a quality above the player. In Player 2, use the quality controls inside the player. Allow time for buffering.</li><li>If Webtor reports no active seeders, try another quality or movie. Reloading cannot create seeders.</li><li>Use Reload player to retry. Fullscreen, volume, and available subtitles are inside the player.</li></ol><p>Leaving this page stops playback.</p></details><details v-if="selected.id!=='local'" class="watch-guide"><summary>Webtor: clear cookies for a CSRF token mismatch</summary><ol><li>In Chrome or Edge on a computer, press F12 (or Ctrl+Shift+I) to open Developer Tools.</li><li>Open Application, then Storage &gt; Cookies &gt; https://webtor.io.</li><li>Delete the Webtor session cookie, or use Clear all cookies for that Webtor entry. This may sign you out of Webtor.</li><li>Return to JhoFlix and click Reload player, or choose another quality in Player 1.</li><li>If the error returns, check whether your browser blocks Webtor's third-party cookies. You can also try Player 2.</li></ol><p>JhoFlix cannot clear another website's cookies automatically.</p></details><div v-if="playing" class="player"><VidSrcPlayer v-if="vidsrcSource" :key="vidsrcVersion" :url="vidsrcSource" :title="selected.title" /><WebtorPlayer v-else-if="webtorSource" :key="webtorVersion" :source="webtorSource" :title="selected.title" :poster="safeUrl(selected.large_cover_image||selected.medium_cover_image)" :imdb-id="selected.imdb_code" /><video v-else ref="video" :src="source||undefined" controls playsinline @loadedmetadata="restorePosition" @playing="onPlaying" @error="videoError"></video><p role="status">{{status}}</p><small>{{stats}}</small></div><p v-if="selected.torrents?.length" class="playback-note">Playback needs available torrent seeds and a supported video format. Leaving this page stops the stream.</p><MovieRecommendations v-if="/^\d+$/.test(String(selected.id))" :key="'recommendations-'+selected.id" :movie="selected" @open="open" /><MovieInformation v-if="backendEnabled&&selected.id!=='local'" :key="'tmdb-'+selected.id" :movie="selected" :server="backendUrl" @information="applyMovieInformation" /></div></section>
 </main>
 <Transition name="snackbar"><div v-if="shareStatus" class="share-snackbar" role="status" aria-live="polite"><div><span>{{shareStatus}}</span><input v-if="shareLink" :value="shareLink" readonly aria-label="Movie share link" @focus="$event.target.select()" @click="$event.target.select()"></div><button type="button" aria-label="Dismiss notification" @click="dismissShare">?</button></div></Transition>
</template>
