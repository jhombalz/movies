<script setup>
import { ref, computed } from 'vue'
const props=defineProps({movie:{type:Object,required:true}})
const comments=ref([]), text=ref(''), score=ref(''), message=ref('')
const key='frame-comments-'+String(props.movie.id)
try{
 const stored=JSON.parse(localStorage.getItem(key)||'[]')
 if(Array.isArray(stored))comments.value=stored.filter(item=>item&&typeof item.id==='string'&&typeof item.text==='string'&&item.text.length<=2000&&Number.isFinite(item.date)&&Math.abs(item.date)<=8640000000000000&&(!item.score||(Number.isInteger(item.score)&&item.score>=1&&item.score<=10))).slice(0,100)
}catch{message.value='Saved comments could not be loaded.'}
const imdbReviews=computed(()=>/^tt\d+$/.test(props.movie.imdb_code||'')?'https://www.imdb.com/title/'+props.movie.imdb_code+'/reviews/':'')
function persist(next){
 try{localStorage.setItem(key,JSON.stringify(next));comments.value=next;message.value='';return true}
 catch{message.value='Your browser could not save this change. Check that browser storage is available.';return false}
}
function addComment(){
 const body=text.value.trim()
 if(!body)return
 if(comments.value.length>=100){message.value='You have reached 100 comments for this movie. Remove a comment before adding another.';return}
 if(persist([{id:crypto.randomUUID(),text:body.slice(0,2000),score:score.value?Number(score.value):null,date:Date.now()},...comments.value])){text.value='';score.value=''}
}
function removeComment(id){persist(comments.value.filter(comment=>comment.id!==id))}
function dateLabel(date){try{return new Date(date).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}catch{return ''}}
</script>

<template>
 <section class="movie-comments" aria-labelledby="comments-heading">
  <div class="comments-heading"><h2 id="comments-heading">Reviews &amp; comments</h2><a v-if="imdbReviews" :href="imdbReviews" target="_blank" rel="noopener noreferrer">Read IMDb reviews ↗</a></div>
  <p class="subtle">Your personal movie notes. Saved in this browser and visible only to you.</p>
  <form class="comment-form" @submit.prevent="addComment">
   <label for="comment-text">Your thoughts</label>
   <textarea id="comment-text" v-model="text" maxlength="2000" rows="3" placeholder="What did you think of this movie?" required></textarea>
   <div class="comment-form-actions"><label for="comment-score">Your rating <select id="comment-score" v-model="score"><option value="">No rating</option><option v-for="n in 10" :key="n" :value="n">{{n}} / 10</option></select></label><button type="submit" class="primary" :disabled="!text.trim()">Save comment</button></div>
  </form>
  <p v-if="message" class="notice" role="alert">{{message}}</p>
  <p v-if="!comments.length" class="subtle">No personal comments yet. Add your first impression.</p>
  <ol v-else class="comment-list"><li v-for="comment in comments" :key="comment.id"><div class="comment-meta"><strong>You</strong><span v-if="comment.score" class="rating">★ {{comment.score}} / 10</span><time :datetime="new Date(comment.date).toISOString()">{{dateLabel(comment.date)}}</time><button @click="removeComment(comment.id)" aria-label="Delete this personal comment">Delete</button></div><p>{{comment.text}}</p></li></ol>
 </section>
</template>
