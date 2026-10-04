export function streamingBase(value) {
  const url=new URL(value)
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('Use an HTTPS server URL, or localhost for local testing.')
  if(url.username||url.password||url.search||url.hash)throw new Error('Enter only your streaming server URL, without credentials or query parameters.')
  return url.href.replace(/\/$/,'')
}

export async function serverRequest(base,path,{signal,method='GET',key,body}={}) {
  const response=await fetch(base+path,{method,signal,headers:{...(key?{Authorization:`Bearer ${key}`} : {}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})
  const data=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(data.error||`Streaming server returned HTTP ${response.status}.`)
  return data
}

export function releaseSession(session) {
  if(!session)return Promise.resolve()
  return serverRequest(session.base,`/api/sessions/${session.id}`,{method:'DELETE',signal:AbortSignal.timeout(10000)}).catch(()=>{})
}
