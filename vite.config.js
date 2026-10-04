import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'
export default defineConfig({ base: './', plugins: [vue(), { name: 'webtorrent-assets', generateBundle() { for (const file of ['webtorrent.min.js', 'sw.min.js']) this.emitFile({type:'asset', fileName:file, source:readFileSync(new URL(`./node_modules/webtorrent/dist/${file}`, import.meta.url))}) }, configureServer(server) { server.middlewares.use((req,res,next) => { const name = req.url?.split('?')[0]?.split('/').pop(); if (!['webtorrent.min.js','sw.min.js'].includes(name)) return next(); res.setHeader('Content-Type','application/javascript'); res.end(readFileSync(new URL(`./node_modules/webtorrent/dist/${name}`,import.meta.url))); }) } }] })
