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
├── services/
│   └── voice-bridge/ # Service Node (Render) — pont audio Twilio ↔ OpenAI pour la démo téléphonique vitrine
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
- `calls` — historique des appels bénéficiaires + transcript + rapport
- `conversation_memory` — mémoire long-terme par bénéficiaire
- `demo_calls` — tracking des démos vitrine (séparé de `calls`), consultable via `/track_calls` (cf. ci-dessous)

## Architecture vocale : WebRTC direct → OpenAI Realtime (GA)
Le client (navigateur, bientôt mobile) parle **en direct** à OpenAI Realtime via WebRTC — plus de LiveKit ni de service Node.js intermédiaire.

Flux d'un appel :
1. `initiate-call` (Edge Fn) — marque le call `notified` + envoie la push Expo (`{ call_id, persona_name }`). Côté simulation web, on saute directement à l'étape 2.
2. `realtime-token` (Edge Fn) — construit le system prompt (`_shared/systemPrompt.ts` + `agent_extra_prompt`), génère un **ephemeral token** GA via `POST /v1/realtime/client_secrets` (token dans `response.value`), passe le call `in_progress`. Le prompt n'est jamais exposé au client.
3. Client — `packages/shared/src/realtime.ts` (`RealtimeSession`) : `getUserMedia` → `RTCPeerConnection` → SDP offer vers `POST /v1/realtime/calls?model=gpt-realtime-2` (`Content-Type: application/sdp`) → data channel `oai-events` (events GA + transcription `whisper-1`).
4. `save-transcript` (Edge Fn) — à la fin, persiste `calls.transcript` (écriture de confiance, service role) puis déclenche `generate-summary`.

Modèle GA imposé : `realtime-token` ramène tout modèle Beta/legacy (`*-realtime-preview`) à `gpt-realtime-2`. Voix par défaut `cedar` (constante dans `realtime-token`).

## Démo vitrine (www.modect.com)
Deux modes accessibles depuis la home (section `#essai`, `apps/web/src/marketing/components/Demo.tsx`) :

**Mode 1 — Navigateur (WebRTC direct)** : composant `DemoWebModal.tsx`. Récupère un ephemeral token via la Edge Function publique `public-realtime-token` (sans auth, prompt démo hardcodé, rate-limit IP 5/h). Réutilise `RealtimeSession` de `@modect/shared`. Durée max 2 min (coupure client). Le prompt instruit l'IA de conclure dès 1 min 30 pour ne pas être coupée en plein milieu.

**Mode 2 — Téléphone (Twilio)** : composant `DemoPhoneModal.tsx`. POST le numéro vers `${VITE_VOICE_BRIDGE_URL}/call` (service Node `services/voice-bridge/` hébergé sur Render). Le service crée un appel sortant Twilio, sert un TwiML qui ouvre un WebSocket `/media-stream`, et fait le pont audio µ-law avec OpenAI Realtime GA. Rate-limit IP 3/h + numéro 3/24h. Coupure serveur 2 min (`MAX_CALL_SECONDS=120`). Prompt aligné sur 2 min (conclusion à 1 min 30).

Numéro Twilio prod : `+33 9 39 03 52 69` (compte upgradé).

**Tracking des démos** : chaque démo (web ou téléphone) crée une row dans la table `demo_calls`. Champs : mode, started_at, ended_at, duration_seconds, phone_prefix (6 chars max pour les appels téléphone), twilio_cost_eur (estimation par durée), openai_cost_eur (estimation par durée), openai_cost_eur_real (coût réel calculé depuis les tokens, mode téléphone uniquement pour l'instant), tokens_input_audio + tokens_input_audio_cached + tokens_output_audio + tokens_input_text + tokens_output_text. Côté web : `DemoWebModal` appelle l'Edge Function `log-demo` (actions `start`/`end`, estimation par durée uniquement). Côté téléphone : `services/voice-bridge` écrit directement dans Supabase via service role key (module `src/tracking.js`), `demoCallId` propagé via TwiML `<Parameter>`. Coût réel calculé en accumulant les events `response.done` d'OpenAI (tarifs `gpt-realtime-2` hardcodés dans tracking.js, conversion USD→EUR à 0.92). Log par appel inclut ratio de cache (`audio_in=X (cached=Y, Z%)`). Consultable via `https://www.modect.com/track_calls?key=<DEMO_TRACK_KEY>` (page `apps/web/src/marketing/TrackCalls.tsx`, Edge Function `list-demos` avec vérif du key en constant-time).

## Variables d'environnement

### apps/web (.env) — app unique (vitrine + back-office)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=      # clé publique anon
VITE_APP_URL=https://app.modect.com
VITE_DASHBOARD_URL=          # https://app.modect.com (prod) / vide en local (liens relatifs)
VITE_VOICE_BRIDGE_URL=       # https://voice.modect.com (prod) / vide en local (cache le bouton "Me faire appeler")
```

### Supabase Edge Functions Secrets
```
OPENAI_API_KEY=
RESEND_API_KEY=
FROM_EMAIL=
DEMO_TRACK_KEY=              # secret pour accéder à /track_calls (générer une chaîne longue aléatoire)
```

### services/voice-bridge (.env) — service Render
```
OPENAI_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_NUMBER=+33939035269
ALLOWED_ORIGINS=https://www.modect.com,https://modect.com
MAX_CALL_SECONDS=120
SUPABASE_URL=                # pour écrire dans demo_calls (tracking /track_calls)
SUPABASE_SERVICE_ROLE_KEY=   # idem ; si absents → tracking désactivé silencieusement
```

## Déploiement
- **Netlify** : **un seul site** (Base directory `apps/web`, `apps/web/netlify.toml`). Faire pointer **les deux domaines** `www.modect.com` + `app.modect.com` vers ce site. L'app route selon le sous-domaine (`src/App.tsx` : `app.*` → back-office, sinon vitrine). `Permissions-Policy: microphone=(self)` pour WebRTC. Penser à whitelister `app.modect.com` dans Supabase → Auth → URL Configuration.
- **Supabase** : `supabase link --project-ref XXX` puis `supabase functions deploy`
- **Render** : Web Service Node pour `services/voice-bridge` (plan **Starter** minimum — le Free dort après 15 min et casse la démo). Région Frankfurt. Custom domain `voice.modect.com` (CNAME). Variables à renseigner dans l'UI Render. Blueprint disponible dans `services/voice-bridge/render.yaml`.
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
supabase functions deploy public-realtime-token
supabase functions deploy log-demo
supabase functions deploy list-demos
supabase functions deploy save-transcript
supabase functions deploy generate-summary
supabase functions deploy list-openai-models

# Push migrations
supabase db push

# Voice-bridge (démo téléphone vitrine) — dev local
cd services/voice-bridge && npm run dev
```
