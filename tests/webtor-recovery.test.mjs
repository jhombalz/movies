import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { computed } from 'vue'
const component=readFileSync(new URL('../src/WebtorPlayer.vue',import.meta.url),'utf8')
const script=component.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'')
function link(source){
 const props={source};const ctx=vm.createContext({computed,defineProps:()=>props})
 vm.runInContext(script+';globalThis.url=webtorUrl',ctx)
 return {props,url:ctx.url}
}
test('Webtor link follows the selected torrent and points to its external page',()=>{
 const page=link('magnet:?xt=urn:btih:'+'a'.repeat(40)+'&dn=Movie')
 assert.equal(page.url.value,'https://webtor.io/'+'a'.repeat(40))
 page.props.source='magnet:?xt=urn:btih:'+'b'.repeat(40)
 // A fresh component is mounted by the parent after quality changes.
 assert.equal(link(page.props.source).url.value,'https://webtor.io/'+'b'.repeat(40))
 assert.match(component,/target="_blank" rel="noopener noreferrer"/)
 assert.match(component,/<strong>Stream<\/strong>/)
 assert.doesNotMatch(component,/<iframe|loadSdk|window.webtor/)
})
test('Webtor rejects malformed identifiers and offers manual entry for torrent URLs',()=>{
 for(const source of ['magnet:?xt=urn:btih:invalid','magnet:?xt=urn:btih:'+'a'.repeat(40)+'/bad','https://example.com/movie.torrent'])assert.equal(link(source).url.value,'')
 assert.match(component,/textarea readonly/)
})
