import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { ref, computed } from 'vue'
const script=file=>readFileSync(new URL('../src/'+file,import.meta.url),'utf8').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'')
function comments(movie,storage){
 const ctx=vm.createContext({ref,computed,defineProps:()=>({movie}),localStorage:storage})
 vm.runInContext(script('MovieComments.vue')+';globalThis.api={comments,message}',ctx)
 return ctx.api
}
test('saved comments display only for their movie without writing to storage',()=>{
 const storage={getItem:key=>key==='frame-comments-42'?JSON.stringify([{id:'saved',text:'A memorable ending',score:8,date:Date.now()}]):null,setItem(){throw Error('Display must not write')}}
 const page=comments({id:42},storage);assert.equal(page.comments.value[0].text,'A memorable ending');assert.equal(page.comments.value[0].score,8)
 assert.equal(comments({id:43},storage).comments.value.length,0)
})
test('carousel follows horizontal drags, changes movie on release, and cancels vertical gestures',()=>{
 const ctx=vm.createContext({ref,computed,onMounted(){},onUnmounted(){},localStorage:{getItem(){return null},removeItem(){}},location:{},URL})
 vm.runInContext(script('App.vue')+';globalThis.api={startHeroSwipe,updateHeroSwipe,finishHeroSwipe,heroDragging,heroDrag,heroIndex}',ctx)
 const api=ctx.api,target={clientWidth:1000,setPointerCapture(){},hasPointerCapture(){return false}}
 const event=(x,y=0)=>({pointerId:1,button:0,target:{closest(){return false}},currentTarget:target,clientX:x,clientY:y})
 api.startHeroSwipe(event(200));api.updateHeroSwipe(event(100));assert.equal(api.heroDragging.value,true);assert.equal(api.heroDrag.value,-100)
 api.finishHeroSwipe(event(100));assert.equal(api.heroIndex.value,1);assert.equal(api.heroDragging.value,false);assert.equal(api.heroDrag.value,0)
 api.startHeroSwipe(event(200));api.updateHeroSwipe(event(195,80));api.finishHeroSwipe(event(100,80));assert.equal(api.heroIndex.value,1);assert.equal(api.heroDragging.value,false)
})
