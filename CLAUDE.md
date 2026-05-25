# MODECT — Guide Claude Code

## Contexte
SaaS de compagnon conversationnel IA pour personnes âgées/isolées.
- **Aidant** (caregiver) : dashboard web, crée les bénéficiaires, configure les sessions, lit les rapports
- **Bénéficiaire** : reçoit des appels vocaux IA sur l'app mobile Expo

## Stack technique
| Composant | Technologie |
|-----------|------------|
| Dashboard web | React 18 + Vite + TypeScript + TailwindCSS |
| App mobile | Expo (React Native) |
| Base de données | Supabase (PostgreSQL + RLS + Auth) |
| Edge Functions | Supabase (Deno) |
| Voix temps réel | OpenAI Realtime API GA (`gpt-realtime-2`) en **WebRTC direct** client ↔ OpenAI |
| Emails | Resend |
| Déploiement web | Netlify |

## Structure monorepo
```
modect/
├── apps/
│   ├── web/          # App web UNIQUE (React + Vite) : vitrine (src/marketing) + back-office (src/pages)
│   │                 #   → www.modect.com (vitrine) + app.modect.com (back-office), routage par sous-domaine
│   └── mobile/       # App bénéficiaire (Expo) — couche vocale à migrer (phase 2)
├── supabase/
│   ├── migrations/   # migrations SQL
│   └── functions/    # Edge Functions Deno
├── packages/
│   └── shared/       # Types + cœur Realtime (realtime.ts) partagés
└── test/             # Référence : test fonctionnel WebRTC GA (à supprimer après validation)
```

## Base de données (tables principales)
- `profiles` — extension de auth.users (trigger `handle_new_user`)
- `beneficiaries` — profil bénéficiaire + config IA
- `session_schedules` — planification récurrente (jours + heure)
- `calls` — historique des appels + transcript + rapport
- `conversation_memory` — mémoire long-terme par bénéficiaire

## Architecture vocale : WebRTC direct → OpenAI Realtime (GA)
Le client (navigateur, bientôt mobile) parle **en direct** à OpenAI Realtime via WebRTC — plus de LiveKit ni de service Node.js intermédiaire.

Flux d'un appel :
1. `initiate-call` (Edge Fn) — marque le call `notified` + envoie la push Expo (`{ call_id, persona_name }`). Côté simulation web, on saute directement à l'étape 2.
2. `realtime-token` (Edge Fn) — construit le system prompt (`_shared/systemPrompt.ts` + `agent_extra_prompt`), génère un **ephemeral token** GA via `POST /v1/realtime/client_secrets` (token dans `response.value`), passe le call `in_progress`. Le prompt n'est jamais exposé au client.
3. Client — `packages/shared/src/realtime.ts` (`RealtimeSession`) : `getUserMedia` → `RTCPeerConnection` → SDP offer vers `POST /v1/realtime/calls?model=gpt-realtime-2` (`Content-Type: application/sdp`) → data channel `oai-events` (events GA + transcription `whisper-1`).
4. `save-transcript` (Edge Fn) — à la fin, persiste `calls.transcript` (écriture de confiance, service role) puis déclenche `generate-summary`.

Modèle GA imposé : `realtime-token` ramène tout modèle Beta/legacy (`*-realtime-preview`) à `gpt-realtime-2`. Voix par défaut `cedar` (constante dans `realtime-token`).

## Variables d'environnement

### apps/web (.env) — app unique (vitrine + back-office)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=      # clé publique anon
VITE_APP_URL=https://app.modect.com
VITE_DASHBOARD_URL=          # https://app.modect.com (prod) / vide en local (liens relatifs)
```

### Supabase Edge Functions Secrets
```
OPENAI_API_KEY=
RESEND_API_KEY=
FROM_EMAIL=
```

## Déploiement
- **Netlify** : **un seul site** (Base directory `apps/web`, `apps/web/netlify.toml`). Faire pointer **les deux domaines** `www.modect.com` + `app.modect.com` vers ce site. L'app route selon le sous-domaine (`src/App.tsx` : `app.*` → back-office, sinon vitrine). `Permissions-Policy: microphone=(self)` pour WebRTC. Penser à whitelister `app.modect.com` dans Supabase → Auth → URL Configuration.
- **Supabase** : `supabase link --project-ref XXX` puis `supabase functions deploy`
- **pg_cron** : cron toutes les minutes → appelle `schedule-calls` via `pg_net`

## Bugs connus et fixes appliqués
- `handle_new_user()` trigger : doit avoir `SET search_path = public` sinon "relation profiles does not exist"
- `formatDate()` dans utils.ts : `dateStyle` incompatible avec options individuelles (`weekday`, `hour`...) — utiliser `options ?? { dateStyle: 'long' }`
- `@modect/shared` dans le web : résolu via alias Vite + paths TypeScript dans tsconfig
- Build Netlify : utiliser `vite build` sans `tsc` (types Supabase incomplets génèrent des `never`)
- Realtime GA : token dans `response.value` (PAS `response.client_secret.value` = Beta) ; endpoint `/v1/realtime/calls` (PAS `/realtime`) ; events `response.output_audio_transcript.*` (fallback Beta `response.audio_transcript.*`)
- `calls.livekit_room_name` / `livekit_room_sid` : colonnes héritées désormais inutilisées (schéma conservé, non écrites)

## Identité visuelle — charte « cocon familial » (apps/web : vitrine + back-office)
- **Couleurs** : terracotta `#C75D3A` (primaire) + ocre `#D9943E` (accent) ; texte brun `#3D2817`/`#6B4423` ; fonds crème `#FBF5EE` / crème sable `#F5EBDC` ; succès sauge `#7BA05B`, erreur brique `#B23A48`
- **Polices** : Fraunces (titres) + Inter (corps)
- **Baseline** : "Une présence pour ceux que vous aimez" (vitrine) / "La présence qui réchauffe" (app)
- **Back-office** : tokens Tailwind `primary`=terracotta, `accent`=ocre (échelles 50–900), palette `slate` réchauffée (neutres taupe/brun) — cf `apps/web/tailwind.config.js`. La vitrine utilise en plus `font-serif`/`font-sans`, `max-w-container`, `tracking-widest`.
- **Accessibilité mobile** : police ≥ 18px, boutons ≥ 72px, pas de gestes complexes

## Commandes utiles
```bash
# Dev app web unique (vitrine + back-office) — port 5173
npm run dev          # ou : cd apps/web && npm run dev

# Déployer les fonctions Supabase
supabase functions deploy schedule-calls
supabase functions deploy initiate-call
supabase functions deploy realtime-token
supabase functions deploy save-transcript
supabase functions deploy generate-summary
supabase functions deploy list-openai-models

# Push migrations
supabase db push
```
