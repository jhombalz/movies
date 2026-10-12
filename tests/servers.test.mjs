import test from 'node:test'
import assert from 'node:assert/strict'
import { serverList, serverHealth } from '../src/servers.js'
test('server list validates URLs, deduplicates origins and labels servers',()=>{
 const list=serverList(['https://one.example/','https://one.example','javascript:alert(1)','https://two.example'])
 assert.equal(list.length,2);assert.equal(list[0].url,'https://one.example');assert.equal(list[1].label,'Server 2')
})
test('server health requires successful JSON with an explicit ok flag',async()=>{
 for(const response of [{ok:false},{ok:true,json:async()=>({})},{ok:true,json:async()=>{throw Error('HTML suspension page')}}])assert.equal(await serverHealth('https://one.example',{fetcher:async()=>response}),false)
 assert.equal(await serverHealth('https://one.example',{fetcher:async()=>({ok:true,json:async()=>({ok:true})})}),true)
 assert.equal(await serverHealth('https://one.example',{fetcher:async()=>{throw Error('Network failure')}}),false)
})
