<script>
let sdkPromise
let playerId = 0
function loadSdk() {
  if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/@webtor/embed-sdk-js/dist/index.min.js'
    script.async = true
    const timeout = setTimeout(() => fail(), 20000)
    function fail() {
      clearTimeout(timeout)
      script.remove()
      sdkPromise = undefined
      reject(new Error('Webtor could not load. Check your connection and try again.'))
    }
    script.onload = () => { clearTimeout(timeout); resolve() }
    script.onerror = fail
    document.head.appendChild(script)
  })
  return sdkPromise
}
</script>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
const props = defineProps({ source: { type: String, required: true }, title: String, poster: String, imdbId: String })
const id = ref(`webtor-player-${++playerId}`)
const error = ref('')
let active = true
let generation=0
async function startPlayer(){
  const current=++generation
  error.value=''
  document.getElementById(id.value)?.replaceChildren()
  id.value=`webtor-player-${++playerId}`
  await nextTick()
  try {
    await loadSdk()
    if (!active||current!==generation) return
    window.webtor = window.webtor || []
    window.webtor.push({
      id:id.value, ...(props.source.startsWith('magnet:') ? { magnet: props.source } : { torrentUrl: props.source }),
      title: props.title, poster: props.poster, imdbId: props.imdbId,
      baseUrl:'https://webtor.io',
      width: '100%', height: '100%', controls: true,
      on(event){
        if(!active||current!==generation)return
        if(event.name==='torrent error')error.value='Webtor could not load this source. Use Reload player or choose another quality.'
      },
    })
  } catch (e) { if (active&&current===generation) error.value = e.message }
}
onMounted(startPlayer)
onBeforeUnmount(() => { active = false;generation++;document.getElementById(id.value)?.replaceChildren() })
</script>

<template>
  <p v-if="error" role="alert">{{ error }}</p>
  <div :id="id" :key="id" class="webtor-player" :aria-label="`${title} Webtor player`"></div>

</template>

<style scoped>
.webtor-player { width: 100%; aspect-ratio: 16/9; min-height: 300px; background: #000; border-radius: 8px; overflow: hidden; }
.webtor-player :deep(iframe) { width: 100%; height: 100%; border: 0; }
</style>
