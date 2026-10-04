# Frame — Personal movie website

Vue 3 + Vite movie catalog with search, genre/rating filters, sorting, details, quality selection, torrent downloads, WebTorrent playback, a persistent local watchlist, and local video playback. Responsive dark cinema design.

## Run step by step

1. Open a terminal in this folder.
2. Run `npm.cmd install` (use `npm install` outside Windows PowerShell).
3. Run `npm.cmd run dev`.
4. Open the localhost URL printed by Vite, usually `http://127.0.0.1:5173`.
5. Browse a movie, open its dedicated detail page, choose quality, and select Watch now or Download torrent. Use Open a movie for files on your device. Movie URLs use `#/movie/<id>` so links and refresh work under XAMPP without rewrite rules. Browser back/forward and the Back to movies link navigate between pages.

## Build for XAMPP

Run `npm.cmd run build`. Serve the contents of `dist` through Apache. With this workspace path, open `http://localhost/me/movies/dist/`. Do not open index.html as a file. Service workers require localhost or HTTPS; accessing the site through a plain HTTP LAN address prevents torrent playback.

## GitHub Pages

Target repository: `https://github.com/jhombalz/movies.git`.

In the repository's Settings > Pages, set the publishing Source to GitHub Actions. Push the project to `main`. The included `.github/workflows/deploy.yml` installs dependencies, runs regression tests, builds with `/movies/` as the base, and deploys `dist`. Once deployment succeeds, the site is available at `https://jhombalz.github.io/movies/`. Local development and XAMPP builds retain the relative base.

## Sources and limitations

The catalog uses the API specified in docs.md: `https://yts.gg/api/v2/list_movies.json`. Availability and browser CORS permission depend on that service. When unavailable, the app explicitly shows three open-movie demo entries. Sintel's default video is a trailer; the full movie can be streamed through its demo torrent. No API key is required. The source document remains unchanged.

Browser WebTorrent needs WebRTC peers and browser-supported codecs. Ordinary desktop torrent seeds alone cannot provide browser playback. Downloads open the provider's torrent URL for use in a desktop client. Torrent playback shares downloaded pieces until you leave the movie page. The installed browser bundle is loaded through its ES module default export. Playback depends on source availability; the app reports errors and missing peers instead of claiming every catalog movie is playable.

Upcoming releases are not implemented: the selected API is a torrent catalog and no verified upcoming-release feed has been supplied. A separate metadata provider can be added later.

Watchlist data stays in this browser's local storage. Movie details are cached in session storage for refresh; uncached numeric movie links request details from the API. Local video files stay on your device and must be selected again after refresh. No login, backend, or public hosting is configured. Reloading clears active playback; leave the movie page to stop torrent transfers. Use media you have permission to access.

## Verification

Production build passes. The local development server, Vue component, and service worker respond with HTTP 200. Live YTS browsing and end-to-end browser/torrent playback have not been verified in this environment.

Run `node --test tests/details-player.test.mjs` for regression checks covering page navigation, refresh, direct links, error handling, player construction, and cancellation when leaving a page.

Dependency audit reports four high-severity findings in the WebTorrent dependency chain, originating from the `ip` package's SSRF address classification issue (GHSA-2p57-rm9w-gvfp). npm proposes an obsolete WebTorrent downgrade rather than a compatible fix. This app uses WebTorrent's packaged browser bundle and has no torrent server backend; review the upstream dependency issue before extending it with server-side torrent processing.
