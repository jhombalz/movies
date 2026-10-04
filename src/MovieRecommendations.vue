<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
const props=defineProps({movie:{type:Object,required:true}})
const emit=defineEmits(['open'])
const movies=ref([]), loading=ref(false), error=ref('')
let request
function image(movie){try{const url=new URL(movie.large_cover_image||movie.medium_cover_image);return ['https:','http:'].includes(url.protocol)?url.href:''}catch{return ''}}
async function load(){
 request?.abort();request=new AbortController();const current=request
 loading.value=true;error.value='';movies.value=[]
 try{
  const response=await fetch('https://yts.gg/api/v2/movie_suggestions.json?movie_id='+encodeURIComponent(props.movie.id),{signal:AbortSignal.any([current.signal,AbortSignal.timeout(12000)])})
  if(!response.ok)throw new Error('Recommendations are unavailable right now.')
  const result=await response.json()
  if(result.status!=='ok'||!Array.isArray(result.data?.movies))throw new Error('Recommendations are unavailable right now.')
  if(current.signal.aborted)return
  const seen=new Set([String(props.movie.id)])
  movies.value=result.data.movies.filter(movie=>{
   if(!movie||!/^\d+$/.test(String(movie.id))||typeof movie.title!=='string'||seen.has(String(movie.id)))return false
   seen.add(String(movie.id));return true
  }).slice(0,8)
 }catch(e){if(!current.signal.aborted)error.value='Recommendations are unavailable right now.'}
 finally{if(current===request)loading.value=false}
}
onMounted(load)
onUnmounted(()=>request?.abort())
</script>

<template>
 <section class="movie-recommendations" aria-labelledby="recommendations-heading">
  <h2 id="recommendations-heading">You might also like</h2>
  <p class="subtle">Recommended movies from YTS</p>
  <p v-if="loading" class="subtle" role="status">Finding similar movies…</p>
  <p v-else-if="error" class="notice" role="status">{{error}} <button @click="load">Try again</button></p>
  <p v-else-if="!movies.length" class="subtle">No recommendations available for this movie yet.</p>
  <div v-else class="recommendations-grid"><article v-for="movie in movies" :key="movie.id" class="card">
   <button class="poster" @click="emit('open',movie)" :aria-label="`View ${movie.title}`"><span class="poster-art"><strong>{{movie.title}}</strong></span><img v-if="image(movie)" :src="image(movie)" :alt="movie.title" loading="lazy" @error="$event.target.style.display='none'"><span v-if="movie.rating" class="score">★ {{movie.rating}}</span><span class="play-overlay">▶</span></button>
   <button class="movie-title" @click="emit('open',movie)">{{movie.title}}</button><p class="card-meta">{{movie.year}} <span>·</span> {{movie.genres?.[0]||'Movie'}}</p>
  </article></div>
 </section>
</template>
