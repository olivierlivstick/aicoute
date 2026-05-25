# MODECT

SaaS de compagnon conversationnel IA pour personnes âgées / isolées.
Un **aidant** configure des appels vocaux IA réguliers vers un **bénéficiaire** et reçoit un résumé après chaque échange.

> Baseline : *« Une présence pour ceux que vous aimez. »*

## Structure du monorepo

```
modect/
├── apps/
│   ├── web/          # Site vitrine public (React + Vite + TS + Tailwind) → modect.com
│   ├── dashboard/    # Dashboard aidant / back-office (React + Vite + TS + Tailwind) → app.modect.com
│   └── mobile/       # App bénéficiaire (Expo)
├── packages/
│   └── shared/       # Types TS + cœur Realtime (realtime.ts) partagés
└── supabase/
    ├── migrations/   # migrations SQL
    └── functions/    # Edge Functions Deno
```

Le monorepo n'utilise pas d'orchestrateur (Turbo/Nx/workspaces) : chaque app gère ses propres dépendances. Le `package.json` racine ne contient que des **scripts de confort**. `@modect/shared` est résolu via **alias Vite + paths TypeScript** dans chaque app.

## Démarrage

```bash
# Installer les dépendances des deux apps web
npm run install:all

# Site vitrine (port 5173)
npm run dev:web

# Dashboard aidant (port 5174)
npm run dev:dashboard
```

| Script racine | Effet |
|---------------|-------|
| `npm run dev:web` / `dev:dashboard` | serveur de dev (vitrine / dashboard) |
| `npm run build:web` / `build:dashboard` | build de production |
| `npm run preview:web` / `preview:dashboard` | prévisualisation du build |
| `npm run install:all` | install des deux apps |

### Variables d'environnement

- **apps/web** (`.env.local`, cf `.env.example`) : `VITE_DASHBOARD_URL` — URL du dashboard vers lequel pointent les CTA Connexion / Créer un compte.
- **apps/dashboard** (`.env`) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`.

Aucun `.env*` (hors `.env.example`) n'est versionné.

## Déploiement (Netlify — multi-sous-domaines)

Chaque app a son **propre `netlify.toml`**. On crée **deux sites Netlify** sur le même compte, chacun pointant sur son sous-dossier :

| Domaine | Site Netlify | Base directory | Publish |
|---------|--------------|----------------|---------|
| `modect.com` | Vitrine | `apps/web` | `apps/web/dist` |
| `app.modect.com` | Dashboard | `apps/dashboard` | `apps/dashboard/dist` |

Netlify lit automatiquement le `netlify.toml` du `base directory` choisi (build command, redirects SPA, headers de sécurité). Le dashboard expose `Permissions-Policy: microphone=(self)` (requis pour l'appel WebRTC temps réel) ; la vitrine non.

### Étapes manuelles sur Netlify

1. **Site vitrine** : New site → Import from Git → repo `modect` → Base directory `apps/web`.
2. **Site dashboard** : New site → Import from Git → repo `modect` → Base directory `apps/dashboard`.
3. **Domaines** (Domain management) :
   - Site vitrine → domaine `modect.com` (+ `www.modect.com`).
   - Site dashboard → sous-domaine `app.modect.com`.
4. **DNS** : pointer `modect.com` et `app.modect.com` vers Netlify (selon le registrar).
5. **Variables d'environnement** :
   - Site vitrine : `VITE_DASHBOARD_URL=https://app.modect.com`
   - Site dashboard : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL=https://app.modect.com`

> Le détail back-end (Supabase, Edge Functions, pg_cron) est documenté dans [DEPLOY.md](DEPLOY.md) et [CLAUDE.md](CLAUDE.md).
