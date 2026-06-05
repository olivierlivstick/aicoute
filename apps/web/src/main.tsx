import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './styles/globals.css'
import { App } from './App'

const root = document.getElementById('root')!
const tree = (
  <StrictMode>
    <App />
  </StrictMode>
)

// Seule la home vitrine ("/" hors app.*) est pré-rendue (SSG, cf. prerender.mjs).
// Là, on HYDRATE le markup statique. Sur toute autre route, l'index.html servi
// (fallback SPA Netlify) contient quand même ce markup home : on le purge avant
// de rendre, pour éviter un mismatch d'hydratation entre la home et la vraie page.
const onVitrineHome =
  window.location.pathname === '/' && !window.location.hostname.startsWith('app.')

if (onVitrineHome && root.hasChildNodes()) {
  hydrateRoot(root, tree)
} else {
  root.replaceChildren()
  createRoot(root).render(tree)
}
