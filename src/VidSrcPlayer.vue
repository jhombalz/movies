<script setup>
defineProps({url:{type:String,required:true},title:String})
</script>
<template>
 <iframe class="vidsrc-player" :src="url" :title="`${title} - Player 2 (VidSrc)`" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
</template>
<style scoped>
.vidsrc-player{display:block;width:100%;aspect-ratio:16/9;min-height:300px;border:0;border-radius:8px;background:#000}
</style>
