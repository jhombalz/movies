<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import VidSrcPlayer from './VidSrcPlayer.vue'
import { embeddedPlayers, playerEmbedUrl } from './vidsrc.js'
import { seriesCatalog, seriesDetails, seriesImage, episodeReleased, seriesRoute } from './series.js'
const titles=ref([]),query=ref(''),loading=ref(false),error=ref(''),more=ref(false),offset=ref(0)
const selected=ref(null),detailsLoading=ref(false),detailsError=ref(''),detailId=ref('')
const season=ref(1),episode=ref(1),provider=ref('vidlink'),version=ref(0),shareStatus=ref(''),shareLink=ref('')
let catalogAbort,detailsAbort,routeVersion=0
const seasons=computed(()=>[...new Set(selected.value?.episodes.map(e=>e.season)||[])].sort((a,b)=>(a===0?1:b===0?-1:a-b)))
const episodes=computed(()=>selected.value?.episodes.filter(e=>e.season===Number(season.value))||[])
const currentEpisode=computed(()=>episodes.value.find(e=>e.episode===Number(episode.value)))
const url=computed(()=>selected.value&&episodeReleased(currentEpisode.value)?playerEmbedUrl(provider.value,{...selected.value,season:season.value,episode:episode.value}):'')
const label=computed(()=>{const p=embeddedPlayers.find(p=>p.id===provider.value);return p?`Player ${p.number} (${p.name})`:'TV player'})
async function load(append=false){
 catalogAbort?.abort();catalogAbort=new AbortController();const current=catalogAbort
 loading.value=true;error.value=''
 if(!append){offset.value=0;titles.value=[];more.value=false}
 try{
  const rows=await seriesCatalog({query:query.value,skip:offset.value,signal:current.signal})
  if(current.signal.aborted)return
  const newRows=rows.filter(row=>!titles.value.some(existing=>existing.id===row.id))
  titles.value=append?[...titles.value,...newRows]:rows
  more.value=rows.length>=50&&newRows.length>0
  offset.value+=rows.length
 }catch(e){if(!current.signal.aborted)error.value=e.message}
 finally{if(current===catalogAbort)loading.value=false}
}
function applyEpisodeRoute(){
 const params=new URLSearchParams(location.hash.split('?')[1]||'')
 const requestedSeason=Number(params.get('season')),requestedEpisode=Number(params.get('episode'))
 const available=selected.value?.episodes||[]
 const first=available.find(e=>e.season>0&&episodeReleased(e))||available.find(e=>episodeReleased(e))||available[0]
 const requested=available.find(e=>e.season===requestedSeason&&e.episode===requestedEpisode)
 const chosen=requested||first
 season.value=chosen?.season??1;episode.value=chosen?.episode??1;shareStatus.value='';shareLink.value=''
}
async function route(){
 const match=location.hash.match(/^#\/tv\/(tt\d{5,12})(?:\?.*)?$/)
 if(!match){routeVersion++;detailsAbort?.abort();selected.value=null;detailId.value=location.hash.startsWith('#/tv/')?'invalid':'';detailsLoading.value=false;detailsError.value=detailId.value?'This series link is invalid.':'';return}
 if(selected.value?.id===match[1]){applyEpisodeRoute();return}
 if(detailsLoading.value&&detailId.value===match[1])return
 const token=++routeVersion
 detailsAbort?.abort();detailsAbort=new AbortController();const current=detailsAbort
 detailId.value=match[1];selected.value=null;detailsLoading.value=true;detailsError.value=''
 try{
  const info=await seriesDetails(match[1],{signal:current.signal})
  if(current.signal.aborted||token!==routeVersion)return
  selected.value=info;if(provider.value==='vidlink'&&!info.tmdb_id)provider.value='vidsrc';applyEpisodeRoute();await nextTick();document.querySelector('#series-heading')?.focus()
 }catch(e){if(!current.signal.aborted)detailsError.value=e.message}
 finally{if(token===routeVersion)detailsLoading.value=false}
}
function open(item){location.hash=seriesRoute(item.id)}
function chooseSeason(){
 const first=episodes.value.find(e=>episodeReleased(e))||episodes.value[0]
 if(first){episode.value=first.episode;chooseEpisode()}
}
function chooseEpisode(){if(selected.value)location.hash=seriesRoute(selected.value.id,Number(season.value),Number(episode.value))}
function nextEpisode(){
 const all=selected.value?.episodes.filter(e=>e.season>0&&episodeReleased(e))||[]
 const index=all.findIndex(e=>e.season===season.value&&e.episode===episode.value),next=all[index+1]
 if(index>=0&&next)location.hash=seriesRoute(selected.value.id,next.season,next.episode)
}
const hasNext=computed(()=>{
 const all=selected.value?.episodes.filter(e=>e.season>0&&episodeReleased(e))||[],index=all.findIndex(e=>e.season===season.value&&e.episode===episode.value)
 return index>=0&&index<all.length-1
})
async function share(){
 const value=new URL(seriesRoute(selected.value.id,season.value,episode.value),location.href).href
 try{await navigator.clipboard.writeText(value);shareStatus.value='Episode link copied!'}catch{shareStatus.value='Copy this episode link:';shareLink.value=value}
}
onMounted(()=>{load();route();window.addEventListener('hashchange',route)})
onUnmounted(()=>{routeVersion++;catalogAbort?.abort();detailsAbort?.abort();window.removeEventListener('hashchange',route)})
</script>
<template>
 <section class="tv-series">
  <template v-if="!detailId">
   <div class="section-heading"><div><p class="eyebrow">ONE MORE EPISODE</p><h1 class="tv-heading">TV Series</h1></div><span class="subtle">Find a show, choose an episode, and press play.</span></div>
   <form class="filters" @submit.prevent="load()"><label class="search"><span>⌕</span><input v-model="query" placeholder="Search TV series..." aria-label="Search TV series"><button type="submit">Search</button></label></form>
   <p v-if="loading" role="status" class="subtle">Loading series...</p>
   <p v-if="error" class="notice" role="alert">{{error}} <button @click="load()">Try again</button></p>
   <div class="grid"><article v-for="item in titles" :key="item.id" class="card"><button class="poster" @click="open(item)" :aria-label="`View ${item.name}`"><span class="poster-art"><strong>{{item.name}}</strong></span><img v-if="seriesImage(item.poster)" :src="seriesImage(item.poster)" :alt="item.name" loading="lazy" @error="$event.target.style.display='none'"><span v-if="item.imdbRating" class="score">★ {{item.imdbRating}}</span><span class="play-overlay">▶</span></button><button class="movie-title" @click="open(item)">{{item.name}}</button><p class="card-meta">{{item.releaseInfo||item.year||'TV Series'}}</p></article></div>
   <p v-if="!loading&&!error&&!titles.length" class="empty">No series found. Try another title.</p>
   <button v-if="more" class="secondary load-more" :disabled="loading" @click="load(true)">Load more series</button>
  </template>
  <template v-else>
   <a class="back-link" href="#/tv">← Back to TV Series</a>
   <p v-if="detailsLoading" class="notice" role="status">Loading series and episodes...</p>
   <p v-else-if="detailsError" class="notice" role="alert">{{detailsError}} <button @click="route">Try again</button></p>
   <div v-else-if="selected" class="movie-details">
    <aside class="detail-poster"><img v-if="seriesImage(selected.poster)" :src="seriesImage(selected.poster)" :alt="selected.name"><span>{{selected.name}}</span></aside>
    <div class="detail-content"><p class="eyebrow">TV SERIES</p><h1 id="series-heading" tabindex="-1">{{selected.name}}</h1><div class="meta"><span v-if="selected.imdbRating" class="rating">★ {{selected.imdbRating}}</span><span>{{selected.releaseInfo||selected.year}}</span><span>{{selected.status}}</span><span>{{selected.genres?.join(' · ')}}</span></div><p class="detail-summary">{{selected.description}}</p>
     <div v-if="seasons.length" class="episode-selectors"><label>Season<select v-model.number="season" @change="chooseSeason"><option v-for="n in seasons" :key="n" :value="n">{{n===0?'Specials':'Season '+n}}</option></select></label><label>Episode<select v-model.number="episode" @change="chooseEpisode"><option v-for="item in episodes" :key="item.episode" :value="item.episode" :disabled="!episodeReleased(item)">{{item.episode}}. {{item.name}}{{!episodeReleased(item)?' (Upcoming)':''}}</option></select></label></div>
     <p v-else class="notice">No episode information is available for this series yet.</p>
     <div class="player-tabs" role="group" aria-label="TV playback provider"><button v-for="p in embeddedPlayers" :key="p.id" :class="{active:provider===p.id}" :aria-pressed="provider===p.id" :disabled="p.id==='vidlink'&&!selected.tmdb_id" @click="provider=p.id">Player {{p.number}} <span>{{p.name}}</span></button></div>
     <p class="player-ad-warning" role="note">These third-party players contain ads and may open popups or new tabs. Close unwanted tabs and return here. Stream availability depends on the provider.</p>
     <template v-if="currentEpisode"><h2 class="episode-title">S{{season}} E{{episode}} · {{currentEpisode.name}}</h2><details v-if="currentEpisode.description" class="watch-guide"><summary>Episode synopsis (may contain spoilers)</summary><p>{{currentEpisode.description}}</p></details></template>
     <div class="actions episode-actions"><button class="primary" :disabled="!url" @click="version++">Reload episode</button><button class="secondary" :disabled="!hasNext" @click="nextEpisode">Next episode →</button><button class="secondary" v-if="currentEpisode" @click="share">Share episode</button></div>
     <p v-if="shareStatus" class="subtle" role="status">{{shareStatus}}</p><input v-if="shareLink" class="tv-share-link" :value="shareLink" readonly aria-label="Episode share link" @focus="$event.target.select()">
     <div v-if="url" class="player"><VidSrcPlayer :key="url+':'+version" :url="url" :title="selected.name+' - S'+season+' E'+episode" :label="label" /></div>
     <p v-else class="notice">This episode is unavailable or has not aired yet. Choose another episode or player.</p>
     <p class="subtle tv-credit">TV catalog and episode information provided by Cinemeta. Episode links preserve the selected season and episode.</p>
    </div>
   </div>
  </template>
 </section>
</template>
<style scoped>
.tv-series{padding:32px 6% 60px}.tv-heading{font-size:38px;letter-spacing:-1px;margin:0}.episode-selectors{display:flex;gap:16px;flex-wrap:wrap;margin:24px 0}.episode-selectors label{display:grid;gap:8px;font-size:12px;color:#aeb3bf}.episode-selectors label:last-child{flex:1;min-width:180px}.episode-selectors select{min-width:120px;width:100%}.episode-title{font-size:22px;margin:20px 0}.tv-credit{margin-top:24px;line-height:1.7}.tv-share-link{width:100%;padding:12px;background:#1b1d22;color:#eee;border:1px solid #303239;border-radius:7px}.detail-poster img{width:100%}@media(max-width:700px){.tv-series{padding-top:24px}.tv-heading{font-size:30px}.tv-series .section-heading>.subtle{display:none}}
.episode-actions{margin-top:24px;gap:12px}.episode-title{margin-top:26px;margin-bottom:22px}
</style>
