import type { Config } from 'tailwindcss'

/**
 * MODECT — tokens visuels
 * Univers : « cocon familial moderne » — chaleureux, organique, rassurant.
 * À l'opposé absolu de la tech-bro SaaS.
 */
const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        terracotta: {
          DEFAULT: '#C75D3A', // primaire — CTAs, accents
          dark: '#8B4A2B',    // hover, focus, texte sur crème
        },
        ocre: '#D9943E',      // secondaire — accents, illustrations
        brun: {
          900: '#3D2817',     // texte principal
          700: '#6B4423',     // texte secondaire
        },
        creme: {
          DEFAULT: '#FBF5EE', // fond principal
          sable: '#F5EBDC',   // fond sections alternées
        },
        sauge: '#7BA05B',     // succès
        brique: '#B23A48',    // erreur
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        md: '8px',   // boutons, inputs
        lg: '12px',  // cartes
        xl: '16px',  // cartes hero, sections imagées
      },
      maxWidth: {
        container: '1200px',
      },
      letterSpacing: {
        widest: '0.18em',
      },
    },
  },
  plugins: [],
}

export default config
