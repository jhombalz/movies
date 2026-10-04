<script setup>
import { ref, computed } from 'vue'
const props=defineProps({movie:{type:Object,required:true}})
const comments=ref([]), message=ref('')
const key='frame-comments-'+String(props.movie.id)
try{
 const stored=JSON.parse(localStorage.getItem(key)||'[]')
 if(Array.isArray(stored))comments.value=stored.filter(item=>item&&typeof item.id==='string'&&typeof item.text==='string'&&item.text.length<=2000&&Number.isFinite(item.date)&&Math.abs(item.date)<=8640000000000000&&(!item.score||(Number.isInteger(item.score)&&item.score>=1&&item.score<=10))).slice(0,100)
}catch{message.value='Saved comments could not be loaded.'}
const imdbReviews=computed(()=>/^tt\d+$/.test(props.movie.imdb_code||'')?'https://www.imdb.com/title/'+props.movie.imdb_code+'/reviews/':'')
function dateLabel(date){try{return new Date(date).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}catch{return ''}}
</script>

<template>
 <section class="movie-comments" aria-labelledby="comments-heading">
  <div class="comments-heading"><h2 id="comments-heading">Reviews &amp; comments</h2><a v-if="imdbReviews" :href="imdbReviews" target="_blank" rel="noopener noreferrer">Read IMDb reviews ↗</a></div>
  <p class="subtle">Previously saved personal comments are visible only in this browser.</p>
  <p v-if="message" class="notice" role="alert">{{message}}</p>
  <p v-if="!comments.length" class="subtle">No comments available for this movie.</p>
  <ol v-else class="comment-list"><li v-for="comment in comments" :key="comment.id"><div class="comment-meta"><strong>You</strong><span v-if="comment.score" class="rating">★ {{comment.score}} / 10</span><time :datetime="new Date(comment.date).toISOString()">{{dateLabel(comment.date)}}</time></div><p>{{comment.text}}</p></li></ol>
 </section>
</template>
