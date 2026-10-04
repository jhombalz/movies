# Deploy Frame on Render

The Node service serves both the built Vue website and torrent video streams. GitHub Pages can also stay online and connect to this service. Render must run a **Web Service**, not a Static Site.

## Option 1: Blueprint

1. Open the Render dashboard and choose **New > Blueprint**.
2. Connect `https://github.com/jhombalz/movies` and select `main`.
3. Render reads `render.yaml`. Review the Free plan and create the service.
4. Wait for deployment to finish. Open the service's `https://...onrender.com` URL.
5. In Render's service **Environment** page, reveal/copy the generated `STREAM_API_KEY`.
6. In the website, expand **Player settings**, select **Node.js streaming server**, and enter that key. The server URL is filled automatically on an `onrender.com` host.
7. Open a movie, choose a quality, and press **Watch now**. Once the server stream is ready, press play in the video controls.

Do not put the private key in GitHub, a `VITE_` environment variable, the URL, or a chat message. The website keeps the key only in memory for the current tab.

## Option 2: Manual Web Service

In Render, choose **New > Web Service**, connect the same repository, and use:

| Setting | Value |
| --- | --- |
| Branch | `main` |
| Runtime | Node |
| Root directory | Leave empty |
| Build command | `npm ci && npm run build -- --base=/` |
| Start command | `npm start` |
| Health check path | `/health` |
| `NODE_VERSION` | `24.19.0` |
| `STREAM_API_KEY` | A long random private key you generate |
| `ALLOWED_ORIGINS` | `https://jhombalz.github.io,http://127.0.0.1:5173,http://localhost:5173` |

Render provides `PORT`. The process binds to `0.0.0.0`. Same-origin requests from the Render website are supported automatically. If you add a custom domain for a separately hosted frontend, add its exact origin to `ALLOWED_ORIGINS`.

## Use the existing GitHub Pages frontend

Open `https://jhombalz.github.io/movies/`, expand **Player settings**, and set:

- Player: **Node.js streaming server**.
- Streaming server URL: your service's `https://...onrender.com` URL.
- Private streaming key: the same `STREAM_API_KEY` set in Render.

The frontend remembers the server URL and player selection, but not the key. Browser WebTorrent remains available in the player dropdown.

## Local backend

Copy `.env.example` to `.env`, replace the key, and run:

```powershell
npm.cmd install
npm.cmd run build -- --base=/
npm.cmd start
```

Open `http://localhost:3000`. Set the server URL to `http://localhost:3000` and enter the key from `.env`. For Vite development, run `npm.cmd run dev` in a second terminal and use the same server URL.

## Playback and resource limits

The service discovers ordinary BitTorrent peers through trackers and DHT; HTTP range streaming sends the video to the browser. It does not transcode: MP4/WebM must contain codecs your browser supports. Seed availability, tracker/network reachability, and the Render service's resources still determine whether a catalog movie can play.

Only one torrent is active at a time. Torrent metadata is limited to 4 GiB total by default (`MAX_TORRENT_BYTES`); this is an admission limit, not a reserved disk allocation. Streams download requested video pieces to temporary storage. Explicitly leaving the page deletes the session and downloaded pieces; abandoned inactive sessions expire after five minutes. Restarting/redeploying loses active playback. Random session URLs grant temporary video access; they do not contain your main streaming key. Protect/share them accordingly.

The Blueprint uses Free for initial testing. Free services spin down after 15 minutes idle, can take about a minute to wake, and can be suspended for unusually high service-initiated traffic. Movie transfers consume bandwidth. Review usage and service limits before extended viewing; a paid service may be needed. See [Render's Free service limitations](https://render.com/docs/free).

## Checks and troubleshooting

- `/health` should return `{"ok":true}` after the service wakes.
- `401`: the key entered in Player settings does not match `STREAM_API_KEY`.
- `403`: add the frontend origin to `ALLOWED_ORIGINS`, then redeploy.
- `409`: stop the previous movie or wait five minutes for abandoned-session cleanup.
- No metadata/peers: try another quality or source; a Node backend cannot create missing seeds.
- Data arrives but the browser cannot play: try another encoding/quality. Codec transcoding is not implemented.

`npm test` checks authentication, ranges, session cleanup, Node compatibility, frontend/server integration, and existing navigation/browser playback. A real Sintel torrent smoke test successfully returned the MP4 header and a range from the end of the file locally. Actual Render playback must be verified after you deploy.

WebTorrent is pinned to `2.8.5`. `scripts/fix-webtorrent-node.mjs` runs after installation and fixes two Node debug-ID conversions that incorrectly treat the parser's text info hash as binary. It is idempotent and fails on an unexpected source layout so dependency updates require review. The browser bundle stays unchanged.
