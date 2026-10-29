import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { ref, nextTick } from 'vue'
const script=readFileSync(new URL('../src/WebtorPlayer.vue',import.meta.url),'utf8').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'')
function player(options={}){
 const embeds=[];let cleanup
 const ctx=vm.createContext({ref,nextTick,playerId:0,defineProps:()=>({source:'magnet:?xt=urn:btih:'+'a'.repeat(40),title:'Movie'}),onMounted(){},onBeforeUnmount(fn){cleanup=fn},loadSdk:options.loadSdk||(()=>Promise.resolve()),window:{webtor:{push:config=>embeds.push(config)}},document:{getElementById:()=>({replaceChildren(){}})},navigator:{clipboard:{writeText:async()=>{throw Error('Clipboard unavailable')}}}})
 vm.runInContext(script+';globalThis.api={startPlayer}',ctx)
 return{...ctx.api,embeds,cleanup:()=>cleanup()}
}
test('retry creates a fresh Webtor embed rather than reusing the failed frame',async()=>{
 const page=player();await page.startPlayer();await page.startPlayer()
 assert.equal(page.embeds.length,2);assert.notEqual(page.embeds[0].id,page.embeds[1].id)
 assert.equal(page.embeds[0].baseUrl,'https://webtor.io')
})
test('leaving while Webtor SDK loads prevents a late embed from mounting',async()=>{
 let resolveSdk,started
 const loading=new Promise(resolve=>{started=resolve})
 const page=player({loadSdk:()=>new Promise(resolve=>{resolveSdk=resolve;started()})})
 const pending=page.startPlayer();await loading;page.cleanup();resolveSdk();await pending
 assert.equal(page.embeds.length,0)
})
