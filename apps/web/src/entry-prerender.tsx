// Entrée SSG — rend la page d'accueil vitrine en HTML au build (sans navigateur).
// Le client hydrate <App/> ; sur "/" (hôte ≠ app.*) son rendu est exactement
// <Home/> car les composants de react-router n'émettent aucun DOM → le markup
// correspond, l'hydratation est propre. Voir scripts/prerender.mjs + main.tsx.
import { renderToString } from 'react-dom/server'
import { Home } from '@/marketing/Home'

export function render(): string {
  return renderToString(<Home />)
}
