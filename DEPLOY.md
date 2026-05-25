# Guide de déploiement MODECT

## Vue d'ensemble

| Composant | Plateforme | URL cible |
|-----------|-----------|-----------|
| Dashboard web (`apps/dashboard`) | Netlify | `https://app.modect.com` |
| Agent service (`apps/agent`) | Railway | `https://agent.modect.app` |
| Base de données & Edge Functions | Supabase Cloud | `https://xxx.supabase.co` |

---

## 1. Supabase Cloud

### Créer le projet
1. Aller sur [supabase.com](https://supabase.com) → New Project
2. Choisir la région **Europe West** (Frankfurt)
3. Noter : `Project URL`, `anon key`, `service_role key`

### Appliquer les migrations
```bash
# Installer la CLI Supabase si besoin
npm install -g supabase

# Lier au projet distant
supabase link --project-ref <VOTRE_PROJECT_REF>

# Pousser les migrations
supabase db push

# Pousser les edge functions
supabase functions deploy schedule-calls
supabase functions deploy initiate-call
supabase functions deploy realtime-agent
supabase functions deploy generate-summary
supabase functions deploy livekit-webhook
```

### Variables d'environnement Supabase (Edge Functions)
Dans le dashboard Supabase → Settings → Edge Functions → Secrets :

```
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_URL=wss://your-project.livekit.cloud
OPENAI_API_KEY=
RESEND_API_KEY=
FROM_EMAIL=noreply@modect.app
AGENT_SERVICE_URL=https://agent.modect.app   ← URL Railway (étape 3)
```

### Configurer le cron pg_cron
Dans le dashboard Supabase → SQL Editor :
```sql
-- Remplacer l'URL et la clé par vos valeurs de production
ALTER DATABASE postgres
  SET app.settings.supabase_url = 'https://xxx.supabase.co';
ALTER DATABASE postgres
  SET app.settings.service_role_key = 'eyJ...';
```

### Configurer le webhook LiveKit
Dans le dashboard LiveKit Cloud → Webhooks :
- URL : `https://xxx.supabase.co/functions/v1/livekit-webhook`
- Events : `room_finished`, `participant_left`, `participant_joined`

---

## 2. Railway (Agent Node.js)

### Déployer depuis GitHub
1. Aller sur [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Sélectionner le repo `modect`
3. **Root directory** : `apps/agent`
4. Railway détecte automatiquement le `Dockerfile`

### Variables d'environnement Railway
Dans le dashboard Railway → Variables :

```
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
OPENAI_API_KEY=
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
PORT=3001
```

### Domaine personnalisé
Dans Railway → Settings → Domains → Add Custom Domain : `agent.modect.app`

Puis mettre à jour `AGENT_SERVICE_URL` dans les secrets Supabase.

---

## 3. Netlify (Dashboard Web)

### Déployer depuis GitHub
1. Aller sur [netlify.com](https://netlify.com) → Add new site → Import from Git
2. Sélectionner le repo `modect`
3. Les paramètres sont lus automatiquement depuis `netlify.toml` :
   - **Base directory** : `apps/dashboard`
   - **Build command** : `npm run build`
   - **Publish directory** : `apps/dashboard/dist`

### Variables d'environnement Netlify
Dans le dashboard Netlify → Site configuration → Environment variables :

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_APP_URL=https://app.modect.app
```

### Domaine personnalisé
Netlify → Domain management → Add custom domain : `app.modect.app`

---

## 4. App Mobile (Expo)

### Build de production
```bash
cd apps/mobile

# Installer EAS CLI
npm install -g eas-cli
eas login

# Configurer le projet
eas build:configure

# Build Android (APK / AAB)
eas build --platform android --profile production

# Build iOS
eas build --platform ios --profile production
```

### Variables à mettre à jour dans `apps/mobile/lib/supabase.ts`
```ts
const supabaseUrl  = 'https://xxx.supabase.co'
const supabaseKey  = 'eyJ...'  // anon key
```

---

## 5. Checklist finale

- [ ] Migrations Supabase appliquées en production
- [ ] Secrets Edge Functions configurés
- [ ] pg_cron URL et clé mis à jour
- [ ] Agent Railway déployé et accessible
- [ ] `AGENT_SERVICE_URL` mis à jour dans Supabase Secrets
- [ ] Webhook LiveKit pointant vers Supabase prod
- [ ] Dashboard Netlify déployé avec les bonnes env vars
- [ ] Domaines personnalisés configurés (DNS)
- [ ] App mobile buildée avec EAS
