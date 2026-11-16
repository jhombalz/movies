<script setup>
import { computed } from 'vue'
const props = defineProps({ source: { type: String, required: true }, title: String, poster: String, imdbId: String })
const webtorUrl = computed(() => {
  const match = props.source.match(/(?:^|[?&])xt=urn:btih:([a-f0-9]{40}|[a-z2-7]{32})(?:&|$)/i)
  return match ? 'https://webtor.io/' + match[1] : ''
})
</script>
<template>
  <section class="webtor-player" aria-label="Watch on Webtor">
    <h2>Watch on Webtor</h2>
    <p>Open the selected quality on Webtor. Under Content, click the <strong>Stream</strong> button next to the video file to start watching.</p>
    <a v-if="webtorUrl" :href="webtorUrl" target="_blank" rel="noopener noreferrer" class="primary">Open in Webtor ?</a>
    <template v-else>
      <p>Open Webtor and paste this torrent source into its input:</p>
      <textarea readonly :value="source" aria-label="Torrent source" />
      <a href="https://webtor.io/" target="_blank" rel="noopener noreferrer" class="primary">Open Webtor ?</a>
    </template>
    <p class="subtle">Playback opens in a new tab. Webtor may show ads; availability depends on the torrent's seeds.</p>
  </section>
</template>
<style scoped>
.webtor-player { padding: 24px; background: #191c20; border: 1px solid #34383e; border-radius: 8px; }
h2 { margin-top: 0; }
p { line-height: 1.7; }
a { display: inline-flex; margin: 8px 0; text-decoration: none; }
textarea { display: block; width: 100%; min-height: 70px; margin-bottom: 12px; }
</style>
