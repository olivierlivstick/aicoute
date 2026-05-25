/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // MODECT — charte « cocon familial » (alignée sur le site vitrine)
        // primary = terracotta, accent = ocre. Les nuances 50–900 sont conservées
        // pour que tous les composants existants (primary-600, accent-700…) suivent.
        primary: {
          DEFAULT: '#C75D3A', // terracotta
          50:  '#FBF1EB',
          100: '#F5DDCF',
          200: '#EABEA6',
          300: '#DE9C78',
          400: '#D27B53',
          500: '#C75D3A',
          600: '#AB4E30',
          700: '#8B4A2B', // terracotta dark (hover/active, texte sur crème)
          800: '#6B3A22',
          900: '#4D2A18',
        },
        accent: {
          DEFAULT: '#D9943E', // ocre
          50:  '#FDF6EC',
          100: '#F9E7C9',
          200: '#F2D098',
          300: '#EAB967',
          400: '#E1A350',
          500: '#D9943E',
          600: '#BC7B2D',
          700: '#976222',
          800: '#724A1A',
          900: '#4F3312',
        },

        // Couleurs nommées de la charte (identiques au site vitrine apps/web)
        terracotta: { DEFAULT: '#C75D3A', dark: '#8B4A2B' },
        ocre: '#D9943E',
        brun: { 900: '#3D2817', 700: '#6B4423' },
        creme: { DEFAULT: '#FBF5EE', sable: '#F5EBDC' },
        sauge: '#7BA05B',  // succès
        brique: '#B23A48', // erreur

        // Surfaces (chaleureuses)
        background: '#FBF5EE', // crème — fond de l'app
        surface: '#FFFFFF',    // blanc — cartes
        muted: '#F5EBDC',      // crème sable — fonds subtils

        // Neutres réchauffés : on surcharge `slate` par des tons taupe/brun
        // pour que tous les gris du dashboard s'accordent à la charte chaude.
        slate: {
          50:  '#FAF6F0',
          100: '#F2EADF',
          200: '#E6D9C9',
          300: '#D3C1AB',
          400: '#AD9A82',
          500: '#8A7560',
          600: '#6B5746',
          700: '#514031',
          800: '#3D2817', // = brun 900
          900: '#2A1B0F',
        },
      },
      fontFamily: {
        title: ['Fraunces', 'Georgia', 'serif'],
        body:  ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        md: '8px',
        lg: '0.75rem',  // 12px
        xl: '1rem',     // 16px
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
