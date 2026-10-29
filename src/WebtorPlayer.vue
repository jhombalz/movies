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
const copyStatus=ref(''),manualSource=ref(''),connecting=ref(false)
let active = true
let generation=0
async function startPlayer(){
  const current=++generation
  error.value='';connecting.value=true
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
        if(event.name==='torrent error')error.value='Webtor could not load this source. Try another quality or open Webtor separately.'
      },
    })
  } catch (e) { if (active&&current===generation) error.value = e.message }
  finally{if(active&&current===generation)connecting.value=false}
}
async function copySource(){
  try{await navigator.clipboard.writeText(props.source);copyStatus.value='Source copied. Open Webtor and paste it into its search field.';manualSource.value=''}
  catch{manualSource.value=props.source;copyStatus.value='Copy the source below, then paste it into Webtor.'}
}
onMounted(startPlayer)
onBeforeUnmount(() => { active = false;generation++;document.getElementById(id.value)?.replaceChildren() })
</script>

<template>
  <p v-if="error" role="alert">{{ error }}</p>
  <div :id="id" :key="id" class="webtor-player" :aria-label="`${title} Webtor player`"></div>
  <div class="webtor-recovery">
    <p>If the player shows “CSRF token mismatch,” try a fresh session. If it persists, copy the source and open Webtor in its own tab.</p>
    <div class="actions"><button class="secondary" :disabled="connecting" @click="startPlayer">{{connecting?'Loading player...':'Retry Webtor session'}}</button><button class="secondary" @click="copySource">Copy movie source</button><a class="secondary" href="https://webtor.io/" target="_blank" rel="noopener noreferrer">Open Webtor in new tab</a></div>
    <p v-if="copyStatus" role="status">{{copyStatus}}</p>
    <textarea v-if="manualSource" :value="manualSource" readonly aria-label="Movie source to copy" @focus="$event.target.select()"></textarea>
    <details><summary>Still seeing the error?</summary><p>Open webtor.io directly to check whether it works there. If it works only in its own tab, check whether your browser blocks third-party cookies for the embedded player. You can allow Webtor cookies for this site. If it fails directly too, Webtor may need to fix its service; trying another movie will not repair a service-wide session issue.</p></details>
  </div>
</template>

<style scoped>
.webtor-player { width: 100%; aspect-ratio: 16/9; min-height: 300px; background: #000; border-radius: 8px; overflow: hidden; }
.webtor-player :deep(iframe) { width: 100%; height: 100%; border: 0; }
.webtor-recovery{margin-top:16px;padding:16px;border:1px solid #ffffff20;border-radius:8px}.webtor-recovery p{margin-top:0}.webtor-recovery details{margin-top:16px;font-size:12px;color:#a1a9b8}.webtor-recovery summary{cursor:pointer;margin-bottom:10px}.webtor-recovery textarea{width:100%;margin-top:12px;min-height:80px;padding:10px;font:inherit;background:#1b1d22;color:#eee;border:1px solid #303239;border-radius:6px;overflow-wrap:anywhere}
</style>
