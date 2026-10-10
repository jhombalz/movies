# Separate frontend and backend

Install dependencies once with `npm.cmd ci`.

## Backend (terminal 1)

Run `npm.cmd start`. Node loads the ignored `.env` file. The server runs on port 3000 and serves the API, without serving the Vue website. Visit http://localhost:3000/api/health to check it. `/health` remains an alias for older deployments. `/` returns a JSON 404.

Keep `TMDB_API_KEY` in `.env`. For local share links, set `PUBLIC_SITE_URL=http://localhost:3000` and `FRONTEND_URL=http://localhost:5173/`. Use `.env.example` as a reference; preserve existing secrets.

## Frontend (terminal 2)

Run `npm.cmd run dev`, then open http://localhost:5173. Local development automatically uses http://127.0.0.1:3000 as the backend.

To use an online backend, copy `.env.local.example` to `.env.local` and set `VITE_API_URL` to its HTTPS origin. Restart Vite after changing this file. The URL is embedded in production builds, so rebuild after changing it. For GitHub Pages set the repository Actions variable `VITE_API_URL` to your public backend origin.

The backend can deploy with `npm ci` and `npm start`, without building the frontend. Deploy the frontend's `dist` folder separately after `npm run build -- --base=/movies/` for GitHub Pages, or `--base=/` for a root-domain host.

Add the frontend origin to backend `ALLOWED_ORIGINS`. Set `FRONTEND_URL` to the frontend website URL and `PUBLIC_SITE_URL` to the public backend origin. Share URLs still serve movie metadata from the backend, then direct visitors to the separate frontend. Public visitors cannot access a backend URL pointing to localhost.
