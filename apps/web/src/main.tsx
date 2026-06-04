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

// Si la home a été pré-rendue (SSG, cf. scripts/prerender.mjs), on HYDRATE le
// markup statique plutôt que de le recréer. Sinon (dev, autres routes) → render.
if (root.hasChildNodes()) {
  hydrateRoot(root, tree)
} else {
  createRoot(root).render(tree)
}
