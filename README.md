# MODECT

SaaS de compagnon conversationnel IA pour personnes âgées / isolées.
Un **aidant** configure des appels vocaux IA réguliers vers un **bénéficiaire** et reçoit un résumé après chaque échange.

> Baseline : *« Une présence pour ceux que vous aimez. »*

## Structure du monorepo

```
modect/
├── apps/
│   ├── web/          # App web UNIQUE : vitrine + back-office (React + Vite + TS + Tailwind)
│   │   └── src/
│   │       ├── marketing/   # vitrine publique (Home + sections)
│   │       ├── pages/       # back-office (auth, dashboard, bénéficiaires…)
│   │       └── components/  # shell back-office (AppLayout, AuthGuard, ui/)
│   └── mobile/       # App bénéficiaire (Expo)
├── packages/
│   └── shared/       # Types TS + cœur Realtime (realtime.ts) partagés
└── supabase/
    ├── migrations/   # migrations SQL
    └── functions/    # Edge Functions Deno
```

`@modect/shared` est résolu via **alias Vite + paths TypeScript**. Le `package.json` racine ne contient que des scripts de confort.

## Une seule app, deux sous-domaines

La vitrine et le back-office sont **la même application**, servie par **un seul site Netlify**. Les deux domaines pointent vers ce site et l'app route selon le sous-domaine (`src/App.tsx`) :

| Adresse | Affichage |
|---------|-----------|
| `www.modect.com` / `modect.com` | **vitrine** (`/` → `marketing/Home`) |
| `app.modect.com` | **back-office** (`/` → `/dashboard`, login Supabase) |

La charte graphique (Tailwind + fonts) est donc **partagée par construction**. Le bouton « Connexion » de la vitrine pointe vers `VITE_DASHBOARD_URL` (= `https://app.modect.com` en prod ; relatif/même origine en local).

## Démarrage

```bash
npm run install:all   # dépendances de apps/web
npm run dev           # http://localhost:5173 (vitrine sur /, back-office sur /auth/login)
npm run build         # build de production → apps/web/dist
```

En local il n'y a pas de sous-domaine : tout est sur `localhost:5173`, la vitrine est sur `/` et le back-office accessible via `/auth/login` (le bouton Connexion utilise un lien relatif).

### Variables d'environnement

`apps/web/.env` (cf [apps/web/.env.example](apps/web/.env.example)) :
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL` — back-office Supabase
- `VITE_DASHBOARD_URL` — cible des CTA Connexion / Créer un compte (prod : `https://app.modect.com`)

Aucun `.env*` (hors `.env.example`) n'est versionné.

## Déploiement (Netlify — un seul site, deux domaines)

1. **Un seul site Netlify** : Import from Git → repo `modect` → **Base directory = `apps/web`** (il lit `apps/web/netlify.toml` : build, redirects SPA, headers WebRTC `microphone=(self)`).
2. **Domaines** (Domain management) — ajouter **les deux** au même site :
   - `modect.com` (+ `www.modect.com`)
   - `app.modect.com`
3. **DNS** : pointer `modect.com` **et** `app.modect.com` vers ce site Netlify.
4. **Variables d'environnement** (sur ce site) :
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_URL=https://app.modect.com`
   - `VITE_DASHBOARD_URL=https://app.modect.com`
5. **Supabase → Authentication → URL Configuration** (sinon magic-link / reset password échouent) :
   - **Site URL** = `https://app.modect.com`
   - **Redirect URLs** = `https://app.modect.com/**` (+ `http://localhost:5173/**` pour le dev)

> Le détail back-end (Supabase, Edge Functions, pg_cron) est documenté dans [DEPLOY.md](DEPLOY.md) et [CLAUDE.md](CLAUDE.md).
