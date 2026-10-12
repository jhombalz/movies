// Set at frontend build time; this contains a public URL, never an API key.
export const API_URL=import.meta.env.VITE_API_URL||(['localhost','127.0.0.1','[::1]'].includes(location.hostname)?'http://127.0.0.1:3000':'https://movies-o9pd.onrender.com')
export const API_URLS=(import.meta.env.VITE_API_URLS||(['localhost','127.0.0.1','[::1]'].includes(location.hostname)?API_URL:'https://frame-movies.onrender.com,https://movies-o9pd.onrender.com,https://movies-fxkd.onrender.com')).split(',').map(url=>url.trim()).filter(Boolean)
