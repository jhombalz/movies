import { readFileSync, writeFileSync } from 'node:fs'

// WebTorrent 2.8.5 parses infoHash as a string but passes it to arr2hex in
// two debug-ID assignments. Its shipped browser bundle already uses strings.
const file=new URL('../node_modules/webtorrent/lib/torrent.js',import.meta.url)
const source=readFileSync(file,'utf8')
const broken='arr2hex(parsedTorrent.infoHash).substring(0, 7)'
const fixed="(typeof parsedTorrent.infoHash === 'string' ? parsedTorrent.infoHash : arr2hex(parsedTorrent.infoHash)).substring(0, 7)"
if(source.includes(fixed)&&!source.includes(broken))process.exit(0)
if(source.split(broken).length!==3)throw new Error('Unexpected WebTorrent source. Review the Node infoHash compatibility patch before updating the dependency.')
writeFileSync(file,source.replaceAll(broken,fixed))
console.log('Applied WebTorrent Node infoHash compatibility fix.')
