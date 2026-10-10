// Set at frontend build time; this contains a public URL, never an API key.
export const API_URL=import.meta.env.VITE_API_URL||(['localhost','127.0.0.1','[::1]'].includes(location.hostname)?'http://127.0.0.1:3000':'')
