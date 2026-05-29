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
| Voix temps réel | **Démo vitrine multi-moteur** : OpenAI Realtime GA (`gpt-realtime-2`) ou Google Gemini Live (`gemini-3.1-flash-live-preview`, voix `Aoede`), au choix via toggle UI. Voix bénéficiaire (app mobile) : OpenAI uniquement pour l'instant |
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
│   └── voice-bridge/ # Service Node (Render) — pont multi-moteur pour la démo vitrine.
│       └── src/engines/  # openai-bridge.js, gemini-bridge.js (téléphone),
│                         # gemini-bridge-web.js (navigateur), audio.js (µ-law ↔ PCM)
├── supabase/
│   ├── migrations/   # migrations SQL
│   └── functions/    # Edge Functions Deno
├── packages/
│   └── shared/       # Types + cœur Realtime partagés :
│                     #   realtime.ts (RealtimeSession, OpenAI WebRTC)
│                     #   geminiLive.ts (GeminiLiveSession, WS proxy via voice-bridge)
└── test/             # Référence : test fonctionnel WebRTC GA (à supprimer après validation)
```

Note : `apps/web/public/gemini-audio-worklet.js` (servi statique) — AudioWorkletProcessor qui downsample le micro 48 kHz → PCM16 16 kHz pour le mode web Gemini.

## Base de données (tables principales)
- `profiles` — extension de auth.users (trigger `handle_new_user`)
- `beneficiaries` — profil bénéficiaire + config IA
- `session_schedules` — planification récurrente + politique no-answer (`calls_per_week`, `days_of_week`, `time_of_day`, `retry_count`, `retry_interval_minutes`, `notify_on_no_answer`, `no_answer_timeout_seconds`). Contrainte : `array_length(days_of_week) == calls_per_week`. Vue `v_schedules_with_history` ajoute `last_call_at`.
- `calls` — historique des appels + transcript + rapport. Colonnes clés : `attempt_number` (1-4), `notified_at` (origine du timer no-answer), `alerts JSONB` (array d'objets `{category, severity, evidence}` — signaux faibles structurés), `twilio_call_sid` (sid Twilio de l'appel sortant pour idempotence + debug), `tokens_*` + `ai_cost_eur_real` (snapshot en fin d'appel, cf. Lot 1 chantier appels planifiés).
- `conversation_memory` — mémoire long-terme par bénéficiaire
- `demo_calls` — tracking des démos vitrine (séparé de `calls`), consultable via `/track_calls` (cf. ci-dessous). Colonne `engine` discrimine OpenAI vs Gemini ; les colonnes tokens et `openai_cost_eur_real` sont réutilisées pour les deux moteurs (sémantique "coût IA réel", quelle que soit l'origine).

## Architecture vocale

Deux canaux distincts selon le contexte d'appel — **les deux partagent le même system prompt** construit via `_shared/callContext.ts` (factorisé entre `realtime-token` et `get-call-context`).

### Canal 1 — Back-office WebRTC direct (simulation aidant)
Utilisé quand l'aidant simule un appel depuis `app.modect.com` (test du contexte / debug). WebRTC direct navigateur ↔ OpenAI.
1. `realtime-token` (Edge Fn) — construit le system prompt via `loadCallContext`, génère un **ephemeral token** GA via `POST /v1/realtime/client_secrets` (token dans `response.value`), passe le call `in_progress`. Le prompt n'est jamais exposé au client.
2. Client — `packages/shared/src/realtime.ts` (`RealtimeSession`) : `getUserMedia` → `RTCPeerConnection` → SDP offer vers `POST /v1/realtime/calls?model=gpt-realtime-2` → data channel `oai-events` (events GA + transcription `whisper-1`).
3. `save-transcript` (Edge Fn) — à la fin, persiste `calls.transcript` puis déclenche `generate-summary`.

### Canal 2 — Appels planifiés Twilio (production)
Utilisé pour les vrais appels vers le bénéficiaire, déclenchés par le worker [schedule-calls](supabase/functions/schedule-calls/index.ts). Le bénéficiaire reçoit un appel sur son téléphone (numéro `beneficiaries.phone`), pas de mobile app nécessaire.

1. **[initiate-call](supabase/functions/initiate-call/index.ts)** — POST `${VOICE_BRIDGE_URL}/scheduled-call` avec `Authorization: Bearer ${MODECT_INTERNAL_TOKEN}`, body `{ call_id, phone }`. Si OK → marque le call `notified` + `notified_at` + `twilio_call_sid`. Si KO → `failed`.
2. **[voice-bridge `/scheduled-call`](services/voice-bridge/src/server.js)** — auth token interne, crée l'appel Twilio sortant avec `timeout=SCHEDULED_RING_TIMEOUT` (30 s) vers TwiML `/scheduled-outgoing` qui ouvre une WS `/scheduled-media-stream` (avec `<Parameter name="call_id">`).
3. **Bénéficiaire décroche** → la WS Twilio démarre :
   - `markCallInProgress(call_id)` côté Supabase (status='in_progress', started_at=now)
   - Instanciation [modect-call-bridge.js](services/voice-bridge/src/engines/modect-call-bridge.js) qui :
     - Fetch le contexte via `get-call-context` (Edge Fn protégée par `MODECT_INTERNAL_TOKEN`, jamais publique)
     - Ouvre WS OpenAI Realtime (µ-law direct, comme la démo vitrine), envoie `session.update` + `response.create`
     - Accumule transcript (events `response.output_audio_transcript.*` côté IA + `conversation.item.input_audio_transcription.completed` côté user) + tokens
4. **Raccrochage** — `flushFinal()` appelle `save-transcript` (qui chaîne `generate-summary` en arrière-plan) puis `recordCallTokens` écrit `ai_cost_eur_real` + tokens directement dans `calls`.
5. **No-answer** — si Twilio raccroche après 30 s sans réponse (ou si l'utilisateur ne décroche jamais), la WS `/scheduled-media-stream` n'est jamais ouverte → le call reste en `notified` → passe B de schedule-calls le marque `missed` après `no_answer_timeout_seconds` et déclenche le retry.

Modèle GA imposé : tout modèle Beta/legacy (`*-realtime-preview`) est ramené à `gpt-realtime-2` par `loadCallContext`. Voix par défaut `cedar`. Coupure serveur de sécurité côté voice-bridge à `MAX_SCHEDULED_CALL_SECONDS` (900 s = 15 min).

## Back-office aidant (app.modect.com)

SPA React mono-utilisateur. Hypothèse : 95% des aidants n'ont qu'**un seul bénéficiaire**, donc l'architecture est centrée sur **un bénéficiaire sélectionné globalement** (pas de listes navigables).

### Layout commun
- **Sidebar gauche** ([AppLayout.tsx](apps/web/src/components/AppLayout.tsx)) : Tableau de bord / Contexte / Planning / Historique / Veille + section « Mon compte » séparée en bas.
- **Header sticky** ([AppHeader.tsx](apps/web/src/components/AppHeader.tsx)) sur toutes les pages : dropdown bénéficiaire (défaut = 1er, persisté localStorage `modect.selected_beneficiary_id`) + bouton « Nouveau proche ».
- **Bénéficiaire sélectionné** partagé via [useSelectedBeneficiary.tsx](apps/web/src/hooks/useSelectedBeneficiary.tsx) (React Context provisionné dans AppLayout). Les pages Contexte / Planning / Historique / Veille lisent `selected` du context, **pas l'URL**.

### Pages
| Route | Rôle | Composant |
|---|---|---|
| `/dashboard` | Vue d'ensemble (cards par bénéficiaire — à retravailler) | [Dashboard.tsx](apps/web/src/pages/dashboard/Dashboard.tsx) |
| `/contexte` | Profil bénéficiaire en **5 onglets** (Infos / Histoire / Goûts / Personnalité / Configuration IA), save inline par section | [ContextePage.tsx](apps/web/src/pages/contexte/ContextePage.tsx) |
| `/planning` | Plannings récurrents, édition **en page** (plus de modal). Liste + calendrier hebdo. | [PlanningPage.tsx](apps/web/src/pages/planning/PlanningPage.tsx) + [ScheduleEditor.tsx](apps/web/src/pages/planning/ScheduleEditor.tsx) |
| `/historique` | **2 onglets** : appels passés / appels prévus (projection sur 14 j à partir des `session_schedules` actifs) | [HistoriquePage.tsx](apps/web/src/pages/historique/HistoriquePage.tsx) |
| `/historique/:id` | Compte-rendu détaillé d'un appel (transcript, alerts structurés en cartes catégorie+gravité+citation) | [CallDetail.tsx](apps/web/src/pages/historique/CallDetail.tsx) |
| `/veille` | Signaux faibles (placeholder — refonte à venir) | [VeillePage.tsx](apps/web/src/pages/veille/VeillePage.tsx) |
| `/compte` | **3 onglets** : Mon profil / Mon abonnement (placeholder) / Mes factures (placeholder) | [ComptePage.tsx](apps/web/src/pages/compte/ComptePage.tsx) |
| `/beneficiary/new` | Wizard d'onboarding 6 étapes (création initiale uniquement — l'édition se fait via `/contexte`) | [BeneficiaryWizard.tsx](apps/web/src/pages/beneficiary/BeneficiaryWizard.tsx) |

Après création via le wizard, le nouveau bénéficiaire est automatiquement sélectionné dans le context puis redirige vers `/contexte`.

### Module administration (`/admin/*`)

Visible uniquement si `profile.role = 'admin'`. Entrée dédiée dans la sidebar (palette `accent` ocre, distincte de la navigation aidant). Garde-fou [RequireAdmin.tsx](apps/web/src/components/RequireAdmin.tsx) + hook [useIsAdmin.ts](apps/web/src/hooks/useIsAdmin.ts).

| Route | Rôle | Composant |
|---|---|---|
| `/admin` | KPI globaux 24h/7j (comptes, bénéficiaires, appels, coût IA, alertes haute sévérité du jour, calls bloqués) | [AdminDashboard.tsx](apps/web/src/pages/admin/AdminDashboard.tsx) |
| `/admin/comptes` | Liste de tous les profils (aidants + admins) avec nb bénéficiaires, nb calls 30j, dernier appel | [AdminComptes.tsx](apps/web/src/pages/admin/AdminComptes.tsx) |
| `/admin/beneficiaires` | Liste globale + colonne aidant + état `notify_call_report` + alerte si pas de téléphone | [AdminBeneficiaires.tsx](apps/web/src/pages/admin/AdminBeneficiaires.tsx) |
| `/admin/appels` | Tous les appels, filtres URL (`?period=`, `?status=`, `?severity=high`), action « Relancer » sur les missed/failed | [AdminAppels.tsx](apps/web/src/pages/admin/AdminAppels.tsx) |
| `/admin/sante` | Calls bloqués (`notified` > 5 min · `in_progress` > 30 min · `scheduled` retry > 5 min) + dernier appel terminé + auto-refresh 30s | [AdminSante.tsx](apps/web/src/pages/admin/AdminSante.tsx) |

**RLS admin** : la migration `20260529000003_admin_role.sql` ajoute une fonction `is_admin()` (SECURITY DEFINER + STABLE) et des policies additives `admin_all_*` qui ouvrent SELECT (et UPDATE/INSERT sur `calls`) à tout admin. Les policies caregiver existantes ne sont pas touchées — les deux jeux sont OU-isés par Postgres.

**Pour rendre un compte admin** : `UPDATE profiles SET role='admin' WHERE email='...'` (CHECK élargi à `caregiver | beneficiary | admin`).

**Action « Relancer »** sur `/admin/appels` : INSERT direct via client supabase (RLS admin autorise) + `supabase.functions.invoke('initiate-call', { body: { call_id } })`. Pas d'Edge Fn dédiée.

**Différé** (non inclus dans ce lot) : impersonate / vue « comme cet aidant », page emails séparée (l'info est déjà sur `calls.report_email_sent_at`).

### Redirections legacy (dans [App.tsx](apps/web/src/App.tsx))
`/sessions → /planning`, `/reports → /historique`, `/reports/:id → /historique/:id`, `/settings → /compte`, `/beneficiary → /contexte`, `/beneficiary/:id → /contexte` (avec sélection auto), `/memories → /dashboard`, `/setup → /compte`.

### Worker planning + politique no-answer
[schedule-calls](supabase/functions/schedule-calls/index.ts) tourne via pg_cron toutes les minutes et exécute 3 passes :
- **A — Planning principal** : `session_schedules` dont `next_scheduled_at` tombe dans ±90s → crée un `call` (`attempt_number=1`) + déclenche `initiate-call` + recalcule `next_scheduled_at`.
- **B — Détection no-answer** : `calls` en `notified` dont `notified_at < now - no_answer_timeout_seconds` → marque `missed`. Si `attempt_number ≤ retry_count` → crée un nouveau call (`attempt+1`, `scheduled_at = now + retry_interval_minutes`). Sinon → email aidant via `noAnswerEmailHtml` (si `notify_on_no_answer`).
- **C — Déclenchement des retries** : `calls` en `scheduled` avec `attempt_number > 1` et `scheduled_at ≤ now` → trigger `initiate-call`.

[initiate-call](supabase/functions/initiate-call/index.ts) déclenche l'appel Twilio via le voice-bridge puis écrit `notified_at = now()` + `twilio_call_sid` au passage en `notified` (origine du timer no-answer). Cf. **Canal 2 — Appels planifiés Twilio** ci-dessus pour le flow complet.

### Signaux faibles structurés
[generate-summary](supabase/functions/generate-summary/index.ts) produit `alerts: Array<{category, severity, evidence}>`. Catégories : `health` (douleur, sommeil, médication, fatigue physique) · `mood` (tristesse, anxiété, lassitude) · `cognition` (oublis, confusion, mots qui manquent) · `social` (solitude, isolement, conflit familial) · `autonomy` (chute, alimentation, gestes du quotidien) · `other`. Sévérité : `low` / `medium` / `high`. Rendu côté UI dans CallDetail (cartes avec icône + badges) et dans l'email aidant.

### Largeurs visuelles (charte)
- **Forms** (Contexte, Compte, ScheduleEditor, CallDetail) : `max-w-5xl` (1024px)
- **Listes/grilles** (Dashboard, Planning, Historique, Veille) : `max-w-7xl` (1280px)
- **Wizard onboarding** : `max-w-4xl` (896px)

## Démo vitrine (www.modect.com)
Deux modes (navigateur / téléphone) × deux moteurs (OpenAI / Gemini), accessibles depuis la home (section `#essai`, `apps/web/src/marketing/components/Demo.tsx`). Un toggle `EngineToggle` au-dessus des cartes choisit le moteur, propagé comme prop `engine` aux deux modals et persisté dans `demo_calls.engine`.

L'architecture est **asymétrique** côté web entre les deux moteurs :
- OpenAI web → WebRTC direct navigateur ↔ OpenAI (token éphémère via Edge Fn)
- Gemini web → WebSocket navigateur ↔ voice-bridge ↔ Gemini (proxy serveur, car Gemini n'a pas d'ephemeral token public et la clé Google doit rester serveur)

**Mode 1 — Navigateur (OpenAI)** : `DemoWebModal.tsx` avec `engine='openai'`. Ephemeral token via Edge Fn `public-realtime-token` (rate-limit IP 5/h). Utilise `RealtimeSession` de `@modect/shared`. WebRTC direct vers OpenAI.

**Mode 1bis — Navigateur (Gemini)** : `DemoWebModal.tsx` avec `engine='gemini'`. Ouvre une WS vers `${VITE_VOICE_BRIDGE_URL}/ws/gemini-web` (proxy voice-bridge). Utilise `GeminiLiveSession` de `@modect/shared` qui charge l'AudioWorklet `/gemini-audio-worklet.js` (capture mic → PCM16 16 kHz) et joue les chunks PCM16 24 kHz reçus via un `AudioContext`. Côté serveur : `services/voice-bridge/src/engines/gemini-bridge-web.js` proxy vers Gemini avec vérif d'origine (`ALLOWED_ORIGINS`) + rate-limit IP 5/h (`LIMITS.perIpWeb`).

**Mode 2 — Téléphone (OpenAI ou Gemini)** : `DemoPhoneModal.tsx`. POST le numéro + `engine` vers `${VITE_VOICE_BRIDGE_URL}/call`. Le service crée un appel Twilio, sert un TwiML qui ouvre une WS `/media-stream` ; le `<Parameter name="engine">` propage le choix. Au start de la WS, server.js dispatche vers `engines/openai-bridge.js` (µ-law direct) ou `engines/gemini-bridge.js` (conversion µ-law 8 kHz ↔ PCM16 16/24 kHz via `engines/audio.js`). Rate-limit IP 3/h + numéro 3/24h. Coupure serveur 2 min (`MAX_CALL_SECONDS=120`).

Numéro Twilio prod : `+33 9 39 03 52 69`. Modèle Gemini par défaut surchargeable via env `GEMINI_MODEL` / `GEMINI_VOICE`.

**Tracking des démos** : chaque démo (web ou téléphone, OpenAI ou Gemini) crée une row dans `demo_calls`. Champs : mode, engine, started_at, ended_at, duration_seconds, phone_prefix (6 chars, mode téléphone uniquement), twilio_cost_eur (estim. durée), openai_cost_eur (estim. durée — nom historique, applicable aux deux moteurs), openai_cost_eur_real (coût IA réel par tokens — applicable aux deux moteurs, dispatch tarifs via `computeAiCostEur(engine, tokens)`), tokens_input_audio + tokens_input_audio_cached + tokens_output_audio + tokens_input_text + tokens_output_text (mutualisés ; `input_audio_cached` reste à 0 pour Gemini qui ne facture pas le cache audio). Côté web : `DemoWebModal` appelle l'Edge Function `log-demo` (actions `start`/`end`). Côté téléphone : `services/voice-bridge/src/tracking.js` écrit directement dans Supabase via service role, `demoCallId` propagé via TwiML `<Parameter>`. Tarifs : OpenAI ($32/$64 in/out par M tokens) et Gemini ($3/$12) hardcodés dans tracking.js, conversion USD→EUR à 0,92. Consultable via `https://www.modect.com/track_calls?key=<DEMO_TRACK_KEY>` (page `TrackCalls.tsx` + Edge Function `list-demos`, colonne "Moteur" badge OpenAI/Gemini).

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
VOICE_BRIDGE_URL=            # URL du service Render (ex: https://voice.modect.com) — utilisé par initiate-call pour POST /scheduled-call
MODECT_INTERNAL_TOKEN=       # secret partagé Supabase ↔ voice-bridge pour les appels planifiés (générer via `openssl rand -hex 32`)
```

### services/voice-bridge (.env) — service Render
```
OPENAI_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_NUMBER=+33939035269
ALLOWED_ORIGINS=https://www.modect.com,https://modect.com  # CRITIQUE : doit inclure les origines qui ouvriront /ws/gemini-web
MAX_CALL_SECONDS=120                # démo vitrine
MAX_SCHEDULED_CALL_SECONDS=900      # appels Modect (15 min max)
SCHEDULED_RING_TIMEOUT=30           # sonnerie max Twilio avant raccrochage auto
SUPABASE_URL=                # écriture demo_calls (tracking /track_calls) + calls (appels planifiés)
SUPABASE_SERVICE_ROLE_KEY=   # idem ; si absents → persistance désactivée silencieusement
MODECT_INTERNAL_TOKEN=       # MÊME valeur que côté Supabase ; si absent → /scheduled-call refusé en 503

# --- Gemini Live (optionnel — sans ces vars, l'engine 'gemini' est refusé en 503) ---
GOOGLE_API_KEY=              # clé Google AI Studio (https://aistudio.google.com/apikey)
GEMINI_MODEL=                # défaut : models/gemini-3.1-flash-live-preview ; override si Google publie un nouveau preview label
GEMINI_VOICE=                # défaut : Aoede (validée meilleure que cedar OpenAI en français)
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
- **ws v8 multi-WSS** : créer deux `WebSocketServer({ server, path })` sur le même HTTP server NE marche PAS — le 1er WSS appelle `abortHandshake(400)` sur tout path qui ne lui correspond pas, empêchant le 2e WSS de répondre (proxy renvoie 404). Voice-bridge utilise donc `noServer: true` + dispatch manuel `server.on('upgrade')` selon `req.url`.
- Gemini Live model ID : `models/gemini-2.5-flash-native-audio` n'existe pas via v1beta ; le bon ID est `models/gemini-3.1-flash-live-preview` (2026-05). Google bouge les preview labels — surcharger via env `GEMINI_MODEL` plutôt que modifier le code.

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
supabase functions deploy get-call-context     # appelée par voice-bridge (auth: MODECT_INTERNAL_TOKEN)
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
