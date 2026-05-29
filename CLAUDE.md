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
| Voix temps réel | **Multi-moteur** OpenAI Realtime GA (`gpt-realtime-2`, voix `cedar`/`marin`) ou Google Gemini Live (`gemini-3.1-flash-live-preview`, voix `Aoede`). Choisi par bénéficiaire via `beneficiaries.preferred_engine` pour les appels planifiés ; choisi par toggle UI pour la démo vitrine. Voix bénéficiaire (app mobile Expo) : phase 2, non branchée pour l'instant. |
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
│   └── voice-bridge/ # Service Node (Render) — pont multi-moteur démos vitrine + appels Modect.
│       └── src/engines/  # openai-bridge.js, gemini-bridge.js (démo téléphone),
│                         # gemini-bridge-web.js (démo navigateur), audio.js (µ-law ↔ PCM),
│                         # modect-call-bridge.js (appels Modect OpenAI),
│                         # modect-gemini-bridge.js (appels Modect Gemini)
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
- `beneficiaries` — profil bénéficiaire + config IA (dont `preferred_engine` : `'openai' | 'gemini'`, défaut OpenAI, choisi dans `/contexte` onglet Configuration IA)
- `session_schedules` — planification récurrente + politique no-answer (`calls_per_week`, `days_of_week`, `time_of_day`, `retry_count`, `retry_interval_minutes`, `notify_on_no_answer`, `no_answer_timeout_seconds`). Contrainte : `array_length(days_of_week) == calls_per_week`. Vue `v_schedules_with_history` ajoute `last_call_at`.
- `calls` — historique des appels + transcript + rapport. Colonnes clés : `attempt_number` (1-4), `notified_at` (origine du timer no-answer + heure effective de déclenchement Twilio), `alerts JSONB` (array d'objets `{category, severity, evidence}` — signaux faibles structurés), `twilio_call_sid` (sid Twilio de l'appel sortant pour idempotence + debug), `engine` (`'openai' | 'gemini' | NULL` — moteur effectif, écrit par initiate-call et confirmé/fallback par le voice-bridge à `markCallInProgress`), `tokens_*` + `ai_cost_eur_real` (snapshot en fin d'appel, tarifs dispatched selon `engine`), `twilio_cost_eur` (coût Twilio RÉEL récupéré async via l'API Twilio par le voice-bridge ; NULL tant que pas remonté → l'UI affiche alors une estimation par la durée). `scheduled_at` est immutable après création (= créneau prévu original).
- `conversation_memory` — mémoire long-terme par bénéficiaire
- `demo_calls` — tracking des démos vitrine (séparé de `calls`), consultable via `/track_calls` (cf. ci-dessous). Colonne `engine` discrimine OpenAI vs Gemini ; les colonnes tokens et `openai_cost_eur_real` sont réutilisées pour les deux moteurs (sémantique "coût IA réel", quelle que soit l'origine).
- `system_events` — log structuré (level / source / call_id / message / payload JSONB) écrit par `schedule-calls`, `initiate-call`, voice-bridge. Lu uniquement par les admins via `/admin/sante`. Sert d'historique d'observabilité sans toucher au reste.

## Architecture vocale

Deux canaux distincts selon le contexte d'appel — **les deux partagent le même system prompt** construit via `_shared/callContext.ts` (factorisé entre `realtime-token` et `get-call-context`).

### Canal 1 — Back-office WebRTC direct (simulation aidant)
Utilisé quand l'aidant simule un appel depuis `app.modect.com` (test du contexte / debug). WebRTC direct navigateur ↔ OpenAI.
1. `realtime-token` (Edge Fn) — construit le system prompt via `loadCallContext`, génère un **ephemeral token** GA via `POST /v1/realtime/client_secrets` (token dans `response.value`), passe le call `in_progress`. Le prompt n'est jamais exposé au client.
2. Client — `packages/shared/src/realtime.ts` (`RealtimeSession`) : `getUserMedia` → `RTCPeerConnection` → SDP offer vers `POST /v1/realtime/calls?model=gpt-realtime-2` → data channel `oai-events` (events GA + transcription `whisper-1`).
3. `save-transcript` (Edge Fn) — à la fin, persiste `calls.transcript` puis **await** `generate-summary` (cf. Bugs connus : EdgeRuntime.waitUntil instable).

### Canal 2 — Appels planifiés Twilio (production)
Utilisé pour les vrais appels vers le bénéficiaire, déclenchés par le worker [schedule-calls](supabase/functions/schedule-calls/index.ts). Le bénéficiaire reçoit un appel sur son téléphone (numéro `beneficiaries.phone`), pas de mobile app nécessaire.

1. **[initiate-call](supabase/functions/initiate-call/index.ts)** — lit `beneficiary.preferred_engine` puis POST `${VOICE_BRIDGE_URL}/scheduled-call` avec `Authorization: Bearer ${MODECT_INTERNAL_TOKEN}`, body `{ call_id, phone, engine }`. Si OK → marque le call `notified` + `notified_at` + `twilio_call_sid` + `engine`. Si KO → `failed`.
2. **[voice-bridge `/scheduled-call`](services/voice-bridge/src/server.js)** — auth token interne, refuse `engine='gemini'` en 503 si `GOOGLE_API_KEY` absente, crée l'appel Twilio sortant avec `timeout=SCHEDULED_RING_TIMEOUT` (30 s) vers TwiML `/scheduled-outgoing` qui ouvre une WS `/scheduled-media-stream` (avec `<Parameter name="call_id">` + `<Parameter name="engine">`).
3. **Bénéficiaire décroche** → la WS Twilio démarre :
   - `markCallInProgress(call_id, engine)` côté Supabase (status='in_progress', started_at=now, engine effectif)
   - Dispatch selon engine — fallback automatique vers OpenAI si gemini demandé mais la clé est absente entre-temps :
     - **OpenAI** → [modect-call-bridge.js](services/voice-bridge/src/engines/modect-call-bridge.js) (µ-law direct, events `response.output_audio_transcript.*` + `conversation.item.input_audio_transcription.completed`)
     - **Gemini** → [modect-gemini-bridge.js](services/voice-bridge/src/engines/modect-gemini-bridge.js) (audio converti µ-law ↔ PCM via `engines/audio.js`, events `serverContent.outputTranscription`/`inputTranscription`, voix `Aoede`)
   - Les deux fetchent le contexte via `get-call-context` (Edge Fn protégée par `MODECT_INTERNAL_TOKEN`, jamais publique) — le prompt est partagé via `_shared/callContext.ts`.
4. **Raccrochage** — `flushFinal()` appelle `save-transcript` (qui chaîne `generate-summary` en arrière-plan) puis `recordCallTokens` écrit `ai_cost_eur_real` + tokens directement dans `calls`.
5. **No-answer / busy / failed** — Twilio notifie le voice-bridge via `POST /scheduled-status` (déclaré comme `statusCallback`), qui marque le call `missed` (no-answer/busy) ou `failed` (failed/canceled) en quelques secondes. **Court-circuite** la passe B qui aurait attendu `no_answer_timeout_seconds` (120s par défaut). La passe B reste un filet de sécurité au cas où le webhook serait perdu.

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
| `/admin/comptes` | Liste de tous les profils (aidants + admins) avec nb bénéficiaires, nb calls 30j, dernier appel + lien « Gérer » | [AdminComptes.tsx](apps/web/src/pages/admin/AdminComptes.tsx) |
| `/admin/comptes/:id` | Édition d'un aidant (nom, email, tél, fuseau ; **rôle en lecture seule**) + liste des bénéficiaires rattachés + zone danger « Supprimer le compte » (désactivée s'il a ≥1 bénéficiaire) | [AdminCompteDetail.tsx](apps/web/src/pages/admin/AdminCompteDetail.tsx) |
| `/admin/beneficiaires` | Liste globale + colonne aidant + état `notify_call_report` + alerte si pas de téléphone + lien « Gérer » | [AdminBeneficiaires.tsx](apps/web/src/pages/admin/AdminBeneficiaires.tsx) |
| `/admin/beneficiaires/:id` | Édition **complète** d'un bénéficiaire (réutilise `BeneficiaryContextEditor`, le même éditeur 5-onglets que `/contexte`) + zone danger « Archiver/Réactiver » et « Effacer définitivement » (confirmation par saisie du nom) | [AdminBeneficiaireDetail.tsx](apps/web/src/pages/admin/AdminBeneficiaireDetail.tsx) |
| `/admin/appels` | Tous les appels, filtres URL (`?period=`, `?status=`, `?severity=high`), action « Relancer » sur les missed/failed | [AdminAppels.tsx](apps/web/src/pages/admin/AdminAppels.tsx) |
| `/admin/sante` | Calls bloqués (`notified` > 5 min · `in_progress` > 30 min · `scheduled` retry > 5 min) + dernier appel terminé + auto-refresh 30s | [AdminSante.tsx](apps/web/src/pages/admin/AdminSante.tsx) |

**RLS admin** : la migration `20260529000003_admin_role.sql` ajoute une fonction `is_admin()` (SECURITY DEFINER + STABLE) et des policies additives `admin_all_*` qui ouvrent SELECT (et UPDATE/INSERT sur `calls`) à tout admin. Les policies caregiver existantes ne sont pas touchées — les deux jeux sont OU-isés par Postgres. La migration `20260529000010_admin_edit_delete.sql` ajoute en plus les policies `admin_update_beneficiaries` / `admin_delete_beneficiaries` et passe `calls.beneficiary_id` en `ON DELETE CASCADE` (sinon l'effacement définitif d'un bénéficiaire ayant des appels échouerait sur la FK).

**Édition / suppression d'un aidant** (`profiles` + `auth.users`) : passe par 2 Edge Functions service-role (`requireAdmin` vérifie le JWT appelant + le rôle), **pas** par la RLS :
- `admin-update-caregiver` — propage le changement d'email à `auth.users.email` (`email_confirm:true`) en plus de `profiles`. Le `role` n'est jamais modifié (lecture seule côté UI).
- `admin-delete-caregiver` — **refuse en 409** si l'aidant a ≥1 bénéficiaire (garde-fou anti-orphelins ; la FK `caregiver_id` est en CASCADE donc sans ce garde-fou la suppression effacerait silencieusement les bénéficiaires), refuse aussi l'auto-suppression, sinon `auth.admin.deleteUser` (cascade → `profiles`).

**Pour rendre un compte admin** : `UPDATE profiles SET role='admin' WHERE email='...'` (CHECK élargi à `caregiver | beneficiary | admin`).

**Action « Relancer »** sur `/admin/appels` : INSERT direct via client supabase (RLS admin autorise) + `supabase.functions.invoke('initiate-call', { body: { call_id } })`. Pas d'Edge Fn dédiée.

**Différé** (non inclus dans ce lot) : impersonate / vue « comme cet aidant », page emails séparée (l'info est déjà sur `calls.report_email_sent_at`).

### Observabilité & robustesse (Lot 4)

- **Table `system_events`** (cf. tables principales) écrite via `_shared/systemEvents.ts` (Edge) ou `persistence/system-events.js` (voice-bridge). Best-effort, jamais bloquant. Lue par la section « Événements système » de `/admin/sante`.
- **Twilio statusCallback** : `POST /scheduled-status` sur le voice-bridge reçoit les transitions Twilio (`no-answer`, `busy`, `failed`, `canceled`, `completed`) et marque le call Modect via `markCallByTwilioStatus`. Permet de détecter un no-answer en quelques secondes au lieu d'attendre 120 s côté passe B. Sur chaque statut terminal, lance aussi `captureTwilioCost(sid)` (fire-and-forget) : le champ `price` d'un appel Twilio est renseigné de façon **asynchrone** (null au moment du `completed`), donc on poll l'API Twilio plusieurs fois avec délai croissant jusqu'à l'obtenir, on convertit en EUR (USD→EUR si besoin) et on écrit `calls.twilio_cost_eur`. Best-effort : si échec, l'UI garde l'estimation par la durée. Pour les appels **antérieurs** à cette capture, endpoint manuel `POST /backfill-twilio-costs` (auth `MODECT_INTERNAL_TOKEN`, body `{limit}`) qui parcourt les `completed` sans `twilio_cost_eur` et récupère leur prix (déjà finalisé → fetch unique sans polling).
- **Vue coûts IA** sur `/admin` : barchart 30 jours + total mensuel, calculé sur `calls.ai_cost_eur_real` (snapshot écrit par le voice-bridge en fin d'appel).
- **Test tronqué** : `npm run test:email-report` (cf. [scripts/test-email-report.mjs](scripts/test-email-report.mjs)) valide la chaîne `save-transcript → generate-summary → email Resend` sans Twilio ni OpenAI Realtime. 30 s, 0 €.
- **Checklist pré-release** : [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) pour les vérifications manuelles qu'aucun test automatique ne couvre (vrai appel Twilio avec audio).

### Redirections legacy (dans [App.tsx](apps/web/src/App.tsx))
`/sessions → /planning`, `/reports → /historique`, `/reports/:id → /historique/:id`, `/settings → /compte`, `/beneficiary → /contexte`, `/beneficiary/:id → /contexte` (avec sélection auto), `/memories → /dashboard`, `/setup → /compte`.

### Worker planning + politique no-answer

**Pré-création des calls** : les calls correspondant à chaque créneau récurrent sont pré-créés à l'avance sur un horizon de **15 jours** par [regenerate-future-calls](supabase/functions/regenerate-future-calls/index.ts). Idempotent grâce au UNIQUE constraint `calls(schedule_id, scheduled_at)` (non-partial — cf. Bugs connus). Déclenché :
- Par le trigger SQL `session_schedules_regenerate_calls` à chaque INSERT/UPDATE/DELETE sur `session_schedules` (via pg_net, secrets lus via `vault.decrypted_secrets`)
- Côté client back-office après save dans [useSessionSchedule.ts](apps/web/src/hooks/useSessionSchedule.ts) (belt+suspenders)
- Devrait l'être par un cron quotidien pour étendre l'horizon (TODO : à câbler avec pg_cron une fois validé)

Conséquences :
- `calls.scheduled_at` est désormais **immutable après création** (= créneau prévu original)
- `calls.notified_at` est l'heure **effective** de déclenchement (écrit par `initiate-call`)
- Le bouton « Déclencher maintenant » du back-office admin n'écrit donc plus que `notified_at`, laissant `scheduled_at` intact pour la traçabilité
- Stats SQL faciles : `SELECT COUNT(*) WHERE scheduled_at BETWEEN X AND Y`

[schedule-calls](supabase/functions/schedule-calls/index.ts) tourne via pg_cron toutes les minutes et exécute 3 passes :
- **A — Déclenchement principal** : lit `calls` en `scheduled` (attempt_number=1) dont `scheduled_at` tombe dans ±90s → déclenche `initiate-call`. **Ne crée plus** de calls (c'est `regenerate-future-calls` qui le fait à l'avance).
- **B — Détection no-answer** : `calls` en `notified` dont `notified_at < now - no_answer_timeout_seconds` → marque `missed`. Si `attempt_number ≤ retry_count` → crée un nouveau call (`attempt+1`, `scheduled_at = now + retry_interval_minutes`). Sinon → email aidant via `noAnswerEmailHtml` (si `notify_on_no_answer`). Le statusCallback Twilio (cf. canal 2) court-circuite généralement la passe B en quelques secondes.
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

**Tracking des démos** : chaque démo (web ou téléphone, OpenAI ou Gemini) crée une row dans `demo_calls`. Champs : mode, engine, started_at, ended_at, duration_seconds, phone_prefix (6 chars, mode téléphone uniquement), twilio_cost_eur (estim. durée), openai_cost_eur (estim. durée — nom historique, applicable aux deux moteurs), openai_cost_eur_real (coût IA réel par tokens — applicable aux deux moteurs, dispatch tarifs via `computeAiCostEur(engine, tokens)`), tokens_input_audio + tokens_input_audio_cached + tokens_output_audio + tokens_input_text + tokens_output_text (mutualisés ; `input_audio_cached` reste à 0 pour Gemini qui ne facture pas le cache audio). Côté web : `DemoWebModal` appelle l'Edge Function `log-demo` (actions `start`/`end`) → écrit ended_at + duration + estimation par durée. **Coût IA réel (tokens)** : pour le web **Gemini**, les tokens ne sont visibles que côté serveur (proxy `gemini-bridge-web.js`), donc le client propage le `demoId` en query (`/ws/gemini-web?demoId=…`) et le voice-bridge complète `openai_cost_eur_real` + `tokens_*` via `recordDemoRealCost` (colonnes disjointes de log-demo → pas de course). Le web **OpenAI** (WebRTC direct) n'a pas encore ce câblage → seule l'estimation par durée est remontée. Côté téléphone : `services/voice-bridge/src/tracking.js` écrit directement dans Supabase via service role, `demoCallId` propagé via TwiML `<Parameter>`, coût réel inclus. Tarifs : OpenAI ($32/$64 in/out par M tokens) et Gemini ($3/$12) hardcodés dans tracking.js, conversion USD→EUR à 0,92. Consultable via `https://www.modect.com/track_calls?key=<DEMO_TRACK_KEY>` (page `TrackCalls.tsx` + Edge Function `list-demos`, colonne "Moteur" badge OpenAI/Gemini).

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
- **pg_cron** : cron toutes les minutes → appelle `schedule-calls` via `pg_net`. Les secrets nécessaires (`supabase_url`, `service_role_key`) sont stockés dans **Supabase Vault** et lus via `vault.decrypted_secrets` (cf. ci-dessous — Supabase managé interdit `ALTER DATABASE SET app.settings.*`).

## Bugs connus et fixes appliqués
- `handle_new_user()` trigger : doit avoir `SET search_path = public` sinon "relation profiles does not exist"
- `formatDate()` dans utils.ts : `dateStyle` incompatible avec options individuelles (`weekday`, `hour`...) — utiliser `options ?? { dateStyle: 'long' }`
- `@modect/shared` dans le web : résolu via alias Vite + paths TypeScript dans tsconfig
- Build Netlify : utiliser `vite build` sans `tsc` (types Supabase incomplets génèrent des `never`)
- Realtime GA : token dans `response.value` (PAS `response.client_secret.value` = Beta) ; endpoint `/v1/realtime/calls` (PAS `/realtime`) ; events `response.output_audio_transcript.*` (fallback Beta `response.audio_transcript.*`)
- `calls.livekit_room_name` / `livekit_room_sid` : colonnes héritées désormais inutilisées (schéma conservé, non écrites)
- **ws v8 multi-WSS** : créer deux `WebSocketServer({ server, path })` sur le même HTTP server NE marche PAS — le 1er WSS appelle `abortHandshake(400)` sur tout path qui ne lui correspond pas, empêchant le 2e WSS de répondre (proxy renvoie 404). Voice-bridge utilise donc `noServer: true` + dispatch manuel `server.on('upgrade')` selon `req.url`.
- Gemini Live model ID : `models/gemini-2.5-flash-native-audio` n'existe pas via v1beta ; le bon ID est `models/gemini-3.1-flash-live-preview` (2026-05). Google bouge les preview labels — surcharger via env `GEMINI_MODEL` plutôt que modifier le code.
- **Supabase managé sans `ALTER DATABASE`** : `ALTER DATABASE postgres SET app.settings.*` est refusé (`permission denied to set parameter`, superuser only). Du coup `current_setting('app.settings.supabase_url')` retourne NULL et toute fonction trigger qui s'en servait fait silencieusement `pg_net.http_post('NULL/...')`. **Solution** : stocker les secrets dans `vault.secrets` (`SELECT vault.create_secret('https://xxx.supabase.co', 'supabase_url')`) et les lire via `vault.decrypted_secrets` depuis une fonction `SECURITY DEFINER` (ex: `trigger_regenerate_future_calls`). Le cron `modect-schedule-calls` suit le même pattern.
- **Postgres `ON CONFLICT` + UNIQUE partial index** : un index `CREATE UNIQUE INDEX ... WHERE ...` ne peut être utilisé par `INSERT ... ON CONFLICT (col)` que si on **répète la clause WHERE**, ce que PostgREST/`supabase.upsert()` ne sait pas faire → erreur « there is no unique or exclusion constraint matching the ON CONFLICT specification ». **Solution** : utiliser un UNIQUE constraint non-partial (les NULL sont distincts par défaut, donc même sémantique fonctionnelle pour les colonnes nullable).
- **`EdgeRuntime.waitUntil` instable** : le pattern fire-and-forget pour chaîner deux Edge Functions (`fetch().catch()` + `EdgeRuntime?.waitUntil`) n'est pas garanti côté runtime Supabase — la fetch est souvent garbage-collected avant d'arriver à destination. **Symptôme observé** : `save-transcript` n'invoquait jamais `generate-summary` en pratique → ni résumé, ni alertes, ni email. **Solution** : `await` la fetch même si ça allonge la latence (la WS Twilio appelante est déjà fermée à ce stade donc impact UX nul).
- **Resend domain verification** : le DKIM verified ne suffit pas pour autoriser l'envoi — il faut aussi SPF + (idéalement) MX vérifiés. Et l'API key par défaut (créée à l'inscription) est **scopée au premier domaine** ; pour envoyer depuis un nouveau domaine il faut créer une nouvelle key avec **Domain = All domains** (mode Full access).

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
supabase functions deploy regenerate-future-calls  # pré-création des calls 15 jours à l'avance
supabase functions deploy log-demo
supabase functions deploy list-demos
supabase functions deploy save-transcript
supabase functions deploy generate-summary
supabase functions deploy list-openai-models
supabase functions deploy admin-update-caregiver  # édition aidant (propage email → auth.users)
supabase functions deploy admin-delete-caregiver  # suppression aidant (refuse si bénéficiaires)

# Push migrations
supabase db push

# Voice-bridge (démo téléphone vitrine) — dev local
cd services/voice-bridge && npm run dev
```
