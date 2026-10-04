import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { ref, computed } from 'vue'
import { randomUUID } from 'node:crypto'
const script=file=>readFileSync(new URL('../src/'+file,import.meta.url),'utf8').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'')
function comments(movie,storage){
 const ctx=vm.createContext({ref,computed,defineProps:()=>({movie}),localStorage:storage,crypto:{randomUUID}})
 vm.runInContext(script('MovieComments.vue')+';globalThis.api={comments,text,score,message,addComment,removeComment}',ctx)
 return ctx.api
}
test('personal comments persist per movie, survive reload, and can be deleted',()=>{
 const data=new Map(), storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}
 const first=comments({id:42},storage);first.text.value='A memorable ending';first.score.value=8;first.addComment()
 const refreshed=comments({id:42},storage);assert.equal(refreshed.comments.value[0].text,'A memorable ending');assert.equal(refreshed.comments.value[0].score,8)
 assert.equal(comments({id:43},storage).comments.value.length,0)
 refreshed.removeComment(refreshed.comments.value[0].id);assert.equal(comments({id:42},storage).comments.value.length,0)
})
test('failed comment storage preserves the draft without falsely displaying a saved comment',()=>{
 const page=comments({id:42},{getItem:()=>null,setItem(){throw Error('Storage unavailable')}})
 page.text.value='Keep this draft';page.addComment();assert.equal(page.text.value,'Keep this draft');assert.equal(page.comments.value.length,0);assert.match(page.message.value,/could not save/)
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
