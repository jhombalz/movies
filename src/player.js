let modulePromise

export async function loadWebTorrent() {
  const url = new URL(`${import.meta.env.BASE_URL}webtorrent.min.js`, document.baseURI).href
  modulePromise ||= import(/* @vite-ignore */ url).catch(error => {
    modulePromise = undefined
    throw error
  })
  const { default: WebTorrent } = await modulePromise
  if (typeof WebTorrent !== 'function') throw new Error('The torrent player module did not export a constructor.')
  return WebTorrent
}

export async function registerPlayerWorker() {
  if (!window.isSecureContext || !navigator.serviceWorker) {
    throw new Error('Torrent playback requires localhost or HTTPS.')
  }
  const registration = await navigator.serviceWorker.register(
    new URL(`${import.meta.env.BASE_URL}sw.min.js`, document.baseURI).href
  )
  const worker = registration.installing || registration.waiting || registration.active
  if (!worker) throw new Error('The video service worker is unavailable.')
  if (worker.state !== 'activated') await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('The video service worker did not activate. Reload and try again.')), 15000)
    const finish = error => {
      clearTimeout(timeout)
      worker.removeEventListener('statechange', check)
      error ? reject(error) : resolve()
    }
    const check = () => {
      if (worker.state === 'activated') finish()
      if (worker.state === 'redundant') finish(new Error('The video service worker could not activate.'))
    }
    worker.addEventListener('statechange', check)
    check()
  })
  // Activation alone does not mean this document's fetches are intercepted yet.
  const controlsPage = () => navigator.serviceWorker.controller?.scriptURL === registration.active?.scriptURL
    && Boolean(navigator.serviceWorker.controller)
  if (!controlsPage()) await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('The video service worker is not controlling this page. Reload normally and try again.')), 15000)
    const finish = error => {
      clearTimeout(timeout)
      navigator.serviceWorker.removeEventListener('controllerchange', check)
      error ? reject(error) : resolve()
    }
    const check = () => { if (controlsPage()) finish() }
    navigator.serviceWorker.addEventListener('controllerchange', check)
    check()
  })
  return registration
}
