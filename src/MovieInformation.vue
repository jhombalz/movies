<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { serverRequest, streamingBase } from './backend.js'
const props=defineProps({movie:{type:Object,required:true},server:{type:String,required:true}})
const emit=defineEmits(['information'])
const information=ref(null),loading=ref(false),error=ref('')
const movieId=props.movie.id, imdb=props.movie.imdb_code
let request
async function load(){
 if(!/^tt\d+$/.test(imdb||''))return
 request?.abort();request=new AbortController();const current=request
 loading.value=true;error.value=''
 try{
  const result=await serverRequest(streamingBase(props.server),'/api/movies/'+encodeURIComponent(imdb),{signal:AbortSignal.any([current.signal,AbortSignal.timeout(30000)])})
  if(current.signal.aborted)return
  information.value=result.movie;emit('information',{id:movieId,movie:result.movie})
 }catch(e){if(!current.signal.aborted)error.value=e.message}
 finally{if(current===request)loading.value=false}
}
function dateLabel(value){const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}
onMounted(load)
onUnmounted(()=>request?.abort())
</script>
<template>
 <section class="movie-information" aria-labelledby="tmdb-heading">
  <h2 id="tmdb-heading">Movie information &amp; reviews</h2>
  <p v-if="loading" class="subtle" role="status">Loading TMDB information and reviews…</p>
  <p v-else-if="error" class="notice" role="status">{{error}} <button @click="load">Try again</button></p>
  <p v-else-if="!information" class="subtle">TMDB information is unavailable for this movie.</p>
  <template v-if="information">
   <p v-if="information.tagline" class="tmdb-tagline">{{information.tagline}}</p>
   <p class="rating">TMDB: {{Number(information.rating||0).toFixed(1)}} / 10 · {{information.votes||0}} votes</p>
   <p v-if="information.releaseDate" class="subtle">Released {{dateLabel(information.releaseDate)}}</p>
   <div v-if="information.cast?.length" class="tmdb-cast"><h3>Cast</h3><ul><li v-for="person in information.cast" :key="person.name+person.character"><strong>{{person.name}}</strong><span>{{person.character}}</span></li></ul></div>
   <div class="comments-heading"><h3>TMDB reviews</h3><a :href="information.url+'/reviews'" target="_blank" rel="noopener noreferrer">View on TMDB ↗</a></div>
   <p v-if="!information.reviews?.length" class="subtle">No TMDB reviews are available for this movie yet.</p>
   <ol v-else class="comment-list"><li v-for="review in information.reviews" :key="review.id"><div class="comment-meta"><strong>{{review.author}}</strong><span v-if="review.rating!=null" class="rating">★ {{review.rating}} / 10</span><time>{{dateLabel(review.date)}}</time></div><details><summary>Read review</summary><p>{{review.content}}</p></details><a v-if="review.url" :href="review.url" target="_blank" rel="noopener noreferrer">Original review ↗</a></li></ol>
  </template>
  <details open class="tmdb-credits"><summary>Data credits</summary><a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer"><img src="https://www.themoviedb.org/assets/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="TMDB" width="100"></a><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p></details>
 </section>
</template>
