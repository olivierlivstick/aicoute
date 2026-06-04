// Postbuild SSG : injecte le HTML pré-rendu de la home dans dist/index.html.
// Lancé après `vite build` (client) + `vite build --ssr` (entry-prerender).
// RÉSILIENT : en cas d'échec, on garde l'index.html SPA (toujours fonctionnel)
// et on n'échoue PAS le build — la dégradation est SEO-only, jamais un deploy cassé.
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const INDEX = resolve('dist/index.html')
const ENTRY = resolve('dist-ssr/entry-prerender.js')
const MARKER = '<div id="root"></div>'

try {
  const { render } = await import(pathToFileURL(ENTRY).href)
  const body = render()
  if (!body || body.length < 500) throw new Error(`rendu vide/suspect (${body?.length ?? 0} o)`)

  const html = readFileSync(INDEX, 'utf8')
  if (!html.includes(MARKER)) throw new Error('balise #root vide introuvable dans index.html')

  writeFileSync(INDEX, html.replace(MARKER, `<div id="root">${body}</div>`))
  console.log(`✓ prerender : ${(body.length / 1024).toFixed(0)} Ko de HTML injectés dans dist/index.html`)
} catch (err) {
  console.warn(`⚠ prerender ignoré (fallback SPA) : ${err.message}`)
} finally {
  rmSync(resolve('dist-ssr'), { recursive: true, force: true })
}
