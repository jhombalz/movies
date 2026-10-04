# Deploy Frame on Render

Node.js streaming is the default player. The website has no player settings or streaming-key field. GitHub Pages automatically uses https://frame-movies.onrender.com; on an onrender.com host it uses that service's own origin. Old browser-saved streaming keys are removed when the app opens.

## Deploy with a Blueprint

1. In Render, choose New > Blueprint and connect jhombalz/movies, branch main.
2. Use the included render.yaml and review the Free plan before deploying.
3. Wait until frame-movies shows Live, then open the service URL.
4. Open a movie, choose its quality, and press Watch now. Press play in the video controls when the stream is ready. No streaming key is needed.

The service hosts both the Vue website and the streaming API. GitHub Pages can remain online as a separate frontend. Existing Blueprint services pick up the PUBLIC_PLAYBACK=true setting on sync; the Node entry point also defaults to public playback when the variable is absent.

## Manual Web Service settings

- Repository: https://github.com/jhombalz/movies
- Branch: main
- Runtime: Node
- Root directory: empty
- Build command: npm ci && npm run build -- --base=/
- Start command: npm start
- Health check: /health
- NODE_VERSION: 24.19.0
- PUBLIC_PLAYBACK: true
- ALLOWED_ORIGINS: https://jhombalz.github.io,http://127.0.0.1:5173,http://localhost:5173

Render provides PORT. The server binds to 0.0.0.0. Same-origin Render requests work automatically. For a separately hosted custom frontend, add its exact origin to ALLOWED_ORIGINS.

## Access and limits

Public playback allows visitors to create streaming sessions without an API key. No server secret is embedded in the frontend. Set PUBLIC_PLAYBACK=false and supply STREAM_API_KEY to require authenticated API calls again; the current simplified frontend does not provide a login/key form.

Only one torrent is active at a time. The default 4 GiB torrent admission limit is controlled by MAX_TORRENT_BYTES. Streams download requested pieces to temporary storage. Leaving a movie deletes its session; abandoned inactive sessions expire after five minutes. Restarts and redeployments clear playback. Random session URLs grant temporary access to that stream.

Available torrent seeds, tracker/network connectivity, disk space, and bandwidth still determine playback. The server does not transcode codecs. Render Free can spin down after 15 minutes idle and may suspend unusually high service-initiated traffic; review https://render.com/docs/free before extended viewing.

## Local development

Copy .env.example to .env. Run npm.cmd install, npm.cmd run build -- --base=/, then npm.cmd start. Open http://localhost:3000. The default frontend points to the Render server; for local backend testing temporarily set backendUrl in src/App.vue to http://localhost:3000 and rebuild.

## Verification and troubleshooting

Run npm test for playback, authentication/private mode, public mode, HTTP range/seek, session cleanup, and navigation checks. Real Sintel MP4 header and end-of-file ranges were successfully streamed locally.

- /health returns {"ok":true} once the service is awake.
- 401 means PUBLIC_PLAYBACK=false; set it to true for the simplified website.
- 403 means the frontend origin is not allowed.
- 409 means another movie is active; stop it or wait five minutes for cleanup.
- No metadata/peers: try another quality or source.
- Unsupported video: try another encoding. Codec transcoding is not implemented.

WebTorrent is pinned to 2.8.5. scripts/fix-webtorrent-node.mjs applies an idempotent install-time fix for two Node debug-ID conversions that incorrectly treat text info hashes as binary data. Dependency updates require review of that patch.
## TMDB movie information and reviews

In Render, open frame-movies > Environment and add TMDB_API_KEY using your TMDB API Key (v3), then save and redeploy. Keep it on the server; do not use a VITE_ variable. The provided key is configured locally in the ignored .env file. Run npm start locally and use the local server origin for the frontend when testing. The server resolves YTS IMDb IDs using TMDB, then returns details, cast, and the first page of reviews. Requests are cached in memory for 30 minutes; no database is required. Existing synopsis and playback stay available if TMDB is unavailable. GitHub Pages requests these details from the Render service.
