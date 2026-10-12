import { streamingBase } from './backend.js'
export function serverList(urls){
 const seen=new Set()
 return urls.flatMap(value=>{try{const url=streamingBase(value);if(seen.has(url))return[];seen.add(url);return[{url,label:'Server '+seen.size,state:'checking'}]}catch{return[]}})
}
export async function serverHealth(url,{signal,fetcher=fetch}={}){
 try{
  const response=await fetcher(url+'/api/health',{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(45000)]):AbortSignal.timeout(45000)})
  if(!response.ok)return false
  const data=await response.json();return data.ok===true
 }catch{return false}
}
