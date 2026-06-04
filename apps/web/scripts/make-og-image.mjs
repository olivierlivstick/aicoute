// Génère l'image Open Graph (partage social) — 1200×630, asset statique.
// Script PONCTUEL : non branché au build. À relancer si la copie/charte change.
//   cd apps/web && node scripts/make-og-image.mjs
// Dépendances one-off (npm i --no-save @resvg/resvg-js sharp) + polices TTF
// sous-settées dans /tmp/ogfonts (voir l'historique de génération).
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'

const W = 1200
const H = 630

// Charte « cocon familial »
const C = {
  creme: '#FBF5EE',
  sable: '#F5EBDC',
  terracotta: '#C75D3A',
  terracottaDark: '#8B4A2B',
  brun900: '#3D2817',
  brun700: '#6B4423',
}

// Photo Hero embarquée (slice dans le panneau de droite)
const heroB64 = readFileSync('public/hero.jpg').toString('base64')
const PHOTO_X = 808 // début du panneau photo

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <clipPath id="photoClip"><rect x="${PHOTO_X}" y="0" width="${W - PHOTO_X}" height="${H}"/></clipPath>
    <linearGradient id="blend" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${C.creme}" stop-opacity="1"/>
      <stop offset="1" stop-color="${C.creme}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Fond crème -->
  <rect width="${W}" height="${H}" fill="${C.creme}"/>

  <!-- Photo (panneau droit, recadrée plein cadre vers le haut) -->
  <image href="data:image/jpeg;base64,${heroB64}" x="${PHOTO_X}" y="0"
         width="${W - PHOTO_X}" height="${H}"
         preserveAspectRatio="xMidYMin slice" clip-path="url(#photoClip)"/>
  <!-- Fondu crème sur le bord gauche de la photo -->
  <rect x="${PHOTO_X}" y="0" width="140" height="${H}" fill="url(#blend)"/>

  <!-- Lueur dorée discrète en haut à droite -->
  <circle cx="${W - 60}" cy="70" r="120" fill="${C.terracotta}" opacity="0.10"/>

  <!-- Logo : tuile terracotta + ondes crème -->
  <g transform="translate(80,64)">
    <rect width="60" height="60" rx="14" fill="${C.terracotta}"/>
    <g stroke="${C.creme}" stroke-width="4.7" stroke-linecap="round">
      <line x1="17" y1="26" x2="17" y2="34"/>
      <line x1="25" y1="19" x2="25" y2="41"/>
      <line x1="34" y1="23" x2="34" y2="37"/>
      <line x1="43" y1="17" x2="43" y2="43"/>
    </g>
    <text x="76" y="44" font-family="Fraunces" font-weight="600" font-size="40">
      <tspan fill="${C.terracotta}">ai</tspan><tspan fill="${C.brun900}">coute</tspan>
    </text>
  </g>

  <!-- Titre -->
  <text x="80" y="290" font-family="Fraunces" font-weight="600" font-size="60" fill="${C.brun900}">Pour ne jamais passer</text>
  <text x="80" y="362" font-family="Fraunces" font-weight="600" font-size="60" fill="${C.terracotta}">une journée sans parler.</text>

  <!-- Sous-titre -->
  <text x="82" y="430" font-family="Inter" font-weight="500" font-size="27" fill="${C.brun700}">Une présence régulière pour vos proches âgés.</text>

  <!-- Réassurance -->
  <text x="82" y="500" font-family="Inter" font-weight="500" font-size="21" fill="${C.terracottaDark}" letter-spacing="0.3">1er appel offert  ·  Sans engagement  ·  RGPD</text>
</svg>`

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: W },
  font: {
    loadSystemFonts: false,
    fontFiles: ['/tmp/ogfonts/fraunces600.ttf', '/tmp/ogfonts/inter500.ttf'],
    defaultFontFamily: 'Fraunces',
  },
})
const png = resvg.render().asPng()
const jpg = await sharp(png).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
writeFileSync('public/og-image.jpg', jpg)
console.log(`public/og-image.jpg écrit — ${(jpg.length / 1024).toFixed(0)} Ko`)
