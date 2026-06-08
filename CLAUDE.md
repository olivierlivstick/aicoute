# AICOUTE — Guide Claude Code

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
| Voix temps réel | **Multi-moteur** OpenAI Realtime GA (`gpt-realtime-2`) ou Google Gemini Live (`gemini-3.1-flash-live-preview`). Moteur **et voix** choisis par bénéficiaire pour les appels planifiés (`beneficiaries.preferred_engine` + voix spécifique au moteur : `ai_voice` pour OpenAI, `gemini_voice` pour Gemini). Catalogue de voix + échantillons audio écoutables dans l'onglet Configuration IA : `packages/shared/src/voices.ts`. Démo vitrine : moteur par toggle UI, voix par défaut du moteur. Voix bénéficiaire (app mobile Expo) : phase 2, non branchée pour l'instant. |
| Emails | Resend |
| Déploiement web | Netlify |

## Structure monorepo
```
modect/
├── apps/
│   ├── web/          # App web UNIQUE (React + Vite) : vitrine (src/marketing) + back-office (src/pages)
│   │                 #   → www.aicoute.fr (vitrine) + app.aicoute.fr (back-office), routage par sous-domaine
│   └── mobile/       # App bénéficiaire (Expo) — couche vocale à migrer (phase 2)
├── services/
│   └── voice-bridge/ # Service Node (Render) — pont multi-moteur démos vitrine + appels AICOUTE.
│       └── src/engines/  # openai-bridge.js, gemini-bridge.js (démo téléphone),
│                         # gemini-bridge-web.js (démo navigateur), audio.js (µ-law ↔ PCM),
│                         # modect-call-bridge.js (appels AICOUTE OpenAI),
│                         # modect-gemini-bridge.js (appels AICOUTE Gemini)
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
- `beneficiaries` — profil bénéficiaire + config IA (dont `preferred_engine` : `'openai' | 'gemini'`, défaut OpenAI, choisi dans `/contexte` onglet Configuration IA — **le moteur est demandé AVANT la voix car les voix sont spécifiques au moteur** ; **voix par moteur** : `ai_voice` (TEXT, défaut résolu `cedar`) = voix OpenAI Realtime, `gemini_voice` (TEXT, `NOT NULL DEFAULT 'Aoede'`) = voix Gemini Live. Chaque moteur garde sa propre voix retenue. Catalogue curé + échantillons audio statiques dans `packages/shared/src/voices.ts` (whitelist DUPLIQUÉE côté edge dans `_shared/callContext.ts` car Deno n'importe pas `packages/shared` → à garder en phase) ; pas de `CHECK` SQL, validation en code avec repli sûr. Échantillons servis depuis `apps/web/public/voice-samples/` (OpenAI `.mp3`, Gemini `.wav`), régénérables via `node apps/web/scripts/make-voice-samples.mjs` (PONCTUEL hors build, requiert `OPENAI_API_KEY` + `GOOGLE_API_KEY`) ; `custom_prompt` TEXT nullable : prompt de personnalité propre au bénéficiaire, copie CONCRÈTE — variables résolues — du défaut, snapshottée à la création par le wizard, éditable dans l'onglet Configuration IA. NULL → fallback sur le défaut `prompt_templates`. `report_recipients` TEXT[] (défaut `{}`) : adresses email de proches qui reçoivent l'email de compte-rendu **en plus** de l'aidant, éditable dans l'onglet « Infos de base » de `/contexte`. L'opt-in global `notify_call_report` gouverne toujours l'envoi ; `normalizeRecipients` (`_shared/email.ts`) dédoublonne + valide la liste aidant+proches. **Deux langues distinctes** : `language_preference` (`fr|en|es|de|it`, défaut `fr`) = langue PARLÉE pendant l'appel (résout `{{langue}}`) ; `report_language` (mêmes 5 langues, défaut `fr`) = langue des RETOURS (résumé, alertes, email, page publique `/r/:token`). La **mémoire** (`conversation_memory`) reste, elle, en langue de CONVERSATION car réinjectée dans les appels suivants. Les deux éditées côte à côte dans l'onglet Configuration IA de `/contexte` + wizard étape 5. i18n centralisée et **dupliquée** : `_shared/reportI18n.ts` (edge : libellés catégories/sévérité/humeur + habillage email + locale date) et `apps/web/src/lib/reportI18n.ts` (web : CallDetail + PublicReport) — à garder en phase)
- `session_schedules` — planification récurrente + politique no-answer (`calls_per_week`, `days_of_week`, `time_of_day`, `retry_count`, `retry_interval_minutes`, `notify_on_no_answer`, `no_answer_timeout_seconds`). Contrainte : `array_length(days_of_week) == calls_per_week`. Vue `v_schedules_with_history` ajoute `last_call_at`.
- `calls` — historique des appels + transcript + rapport. Colonnes clés : `attempt_number` (1-4), `notified_at` (origine du timer no-answer + heure effective de déclenchement Twilio), `alerts JSONB` (array d'objets `{category, severity, evidence}` — signaux faibles structurés), `twilio_call_sid` (sid Twilio de l'appel sortant pour idempotence + debug), `engine` (`'openai' | 'gemini' | NULL` — moteur effectif, écrit par initiate-call et confirmé/fallback par le voice-bridge à `markCallInProgress`), `tokens_*` + `ai_cost_eur_real` (snapshot en fin d'appel, tarifs dispatched selon `engine`), `twilio_cost_eur` (coût Twilio RÉEL récupéré async via l'API Twilio par le voice-bridge ; NULL tant que pas remonté → l'UI affiche alors une estimation par la durée). `report_token` + `report_token_expires_at` : jeton de partage public du compte-rendu (page `/r/:token` sans login, expire 48h), ré-émis à chaque envoi d'email par `issueReportToken` (`_shared/reportToken.ts`). `report_language` : **snapshot** de `beneficiaries.report_language` écrit par `generate-summary` au moment de la génération (fige la langue du rapport même si le réglage change ensuite ; NULL sur les appels antérieurs → fallback `fr` à la lecture). `fluidity_metrics JSONB` (nullable) : snapshot technique de **fluidité** écrit par le voice-bridge en fin d'appel (latence de prise de parole « le blanc », barge-ins, faux barge-in/bruit, « allô ? », contexte) — **Étape 0 = observation pure**, aucun réglage auto ; produit par `engines/fluidity.js`, consultable via le CTA « Qualité » de `/admin/appels`. `scheduled_at` est immutable après création (= créneau prévu original).
- `conversation_memory` — mémoire long-terme par bénéficiaire (extraite par `generate-summary` après chaque appel). Injectée dans le prompt (top 15 par importance) ET le résumé du **dernier appel terminé** (section « VOTRE DERNIÈRE CONVERSATION »). Consultable + éditable (corriger/ajouter/supprimer) dans l'onglet **Mémoire** de `/contexte` et `/admin/beneficiaires/:id` (hook `useMemories`, CRUD). RLS : aidant (`caregiver_owns_memory`, ALL) + admin (SELECT via `…0003` + INSERT/UPDATE/DELETE via `20260531000001`).
- `prompt_templates` — table **singleton** (`id=1`) du prompt système PAR DÉFAUT de la plateforme, éditable par l'admin via `/admin/prompt`. Contient la personnalité + les règles avec variables `{{persona}} {{prenom}} {{langue}} {{style}} {{il_elle}}`. RLS : SELECT `USING(true)` + UPDATE admin ; **GRANT** explicite anon/authenticated (table créée par migration brute → sans GRANT, PostgREST renvoie « permission denied » — cf. Bugs connus).
- `demo_calls` — tracking des démos vitrine (séparé de `calls`), consultable dans **`/admin/appels` onglet « Démos vitrine »** (anciennement page publique `/track_calls`, retirée le 2026-06-07). Colonne `engine` discrimine OpenAI vs Gemini ; les colonnes tokens et `openai_cost_eur_real` sont réutilisées pour les deux moteurs (sémantique "coût IA réel", quelle que soit l'origine). `fluidity_metrics JSONB` (même forme que `calls.fluidity_metrics`) écrit pour les 3 chemins démo passant par le voice-bridge (tél OpenAI/Gemini + web Gemini ; **pas** le web OpenAI WebRTC, hors boucle serveur) — colonne « Qualité » de l'onglet Démos.
- `system_events` — log structuré (level / source / call_id / message / payload JSONB) écrit par `schedule-calls`, `initiate-call`, voice-bridge. Lu uniquement par les admins via `/admin/sante`. Sert d'historique d'observabilité sans toucher au reste.

## Architecture vocale

Deux canaux distincts selon le contexte d'appel — **les deux partagent le même system prompt** construit via `_shared/callContext.ts` (factorisé entre `realtime-token` et `get-call-context` ; `realtime-token` appelle aussi `loadCallContext` depuis le refactor — plus de duplication).

**Construction du prompt** (`_shared/systemPrompt.ts`) : `instructions = [TEMPLATE éditable, interpolé] + [BLOC CONTEXTE assemblé par le code]`.
- **TEMPLATE** = personnalité + règles. Cascade : `beneficiaries.custom_prompt` (déjà concret → tel quel) → `prompt_templates.template` (défaut DB, variables résolues par `resolvePromptPlaceholders`) → `CODE_DEFAULT_TEMPLATE` (filet codé en dur). `loadCallContext` lit le défaut + `custom_prompt` et les passe à `buildSystemPrompt(..., defaultTemplate, customPrompt)`.
- **BLOC CONTEXTE** (jamais éditable, `buildContextBlock`) = infos bénéficiaire + `VOTRE DERNIÈRE CONVERSATION` (résumé du dernier appel `completed`) + `CE QUE TU TE RAPPELLES` (mémoire) + sujets suggérés + **durée cible** (spécifique à l'appel).
- ⚠️ `resolvePromptPlaceholders` existe en DOUBLE : `packages/shared/promptTemplate.ts` (web : snapshot wizard + reset) et `systemPrompt.ts` (edge) car Deno n'importe pas `packages/shared`. Le texte du défaut existe en TRIPLE : seed migration `20260531000002` (source DB), `CODE_DEFAULT_TEMPLATE` (filet edge), `DEFAULT_PROMPT_TEMPLATE` (shared, reset/affichage). À garder en phase.

### Canal 1 — Back-office WebRTC direct (simulation aidant)
Utilisé quand l'aidant simule un appel depuis `app.aicoute.fr` (test du contexte / debug). WebRTC direct navigateur ↔ OpenAI.
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
     - **Gemini** → [modect-gemini-bridge.js](services/voice-bridge/src/engines/modect-gemini-bridge.js) (audio converti µ-law ↔ PCM via `engines/audio.js`, events `serverContent.outputTranscription`/`inputTranscription`, voix = `ctx.gemini_voice` du bénéficiaire avec fallback env `GEMINI_VOICE`/`Aoede`)
   - Les deux fetchent le contexte via `get-call-context` (Edge Fn protégée par `MODECT_INTERNAL_TOKEN`, jamais publique) — le prompt est partagé via `_shared/callContext.ts`.
4. **Raccrochage** — `flushFinal()` appelle `save-transcript` (qui chaîne `generate-summary` en arrière-plan) puis `recordCallTokens` écrit `ai_cost_eur_real` + tokens directement dans `calls`.
5. **No-answer / busy / failed** — Twilio notifie le voice-bridge via `POST /scheduled-status` (déclaré comme `statusCallback`), qui marque le call `missed` (no-answer/busy) ou `failed` (failed/canceled) en quelques secondes. **Court-circuite** la passe B qui aurait attendu `no_answer_timeout_seconds` (120s par défaut). La passe B reste un filet de sécurité au cas où le webhook serait perdu.

Modèle GA imposé : tout modèle Beta/legacy (`*-realtime-preview`) est ramené à `gpt-realtime-2` par `loadCallContext`. Voix par défaut `cedar`. Coupure serveur de sécurité côté voice-bridge à `MAX_SCHEDULED_CALL_SECONDS` (900 s = 15 min).

> **⏰ Veille modèles voix — À REFAIRE PÉRIODIQUEMENT (~tous les 1–2 mois).** La **qualité de la conversation est le cœur du produit** et les modèles audio temps réel progressent vite. Vérifier régulièrement (doc/​changelog OpenAI Realtime + Gemini Live, recherche web) si un modèle **plus récent ou meilleur** est sorti, et le **tester avant bascule**. Migration sans douleur : Gemini via l'env `GEMINI_MODEL` (cf. Bugs connus), OpenAI via le label/snapshot dans `_shared/callContext.ts` + bridges voice-bridge.
> **Bouton self-service** : `/admin/sante` → section « Veille modèles voix » → CTA « Lancer la veille » appelle l'Edge Fn `model-watch` (OpenAI Responses API + outil `web_search`, réservée admin via `requireAdmin`) qui compare les modèles EN SERVICE (baseline DUPLIQUÉE dans `model-watch/index.ts` — à garder en phase avec ce doc) à ce qui existe sur le web et renvoie un verdict structuré + sources. Résultat journalisé dans `system_events` (source `model-watch`) → réaffiché au chargement de la page. Modèle de recherche overridable via l'env `MODEL_WATCH_MODEL` (défaut `gpt-4.1`).
> - **État vérifié le 2026-06-05 : on est à jour.** OpenAI `gpt-realtime-2` (snapshot 2026-05-07, dernier généraliste temps réel) ; Gemini `models/gemini-3.1-flash-live-preview` (sorti 2026-03-26, dernier ; toujours *Preview*, pas de GA). Voix actuelles : cedar/marin (OpenAI), Aoede (Gemini).
> - **Levier qualité hors version** : `gpt-realtime-2` expose un `reasoning_effort` configurable (minimal→very high, **défaut `low`**) + contexte 128k. Tester `medium` pour des réponses plus pertinentes (léger surcoût de latence) — non câblé pour l'instant.

### Fluidité de la conversation (VAD / tour de parole)

La fluidité est un axe produit prioritaire. Trois symptômes traités, chacun via la **détection d'activité vocale (VAD)** — orthogonaux : début de parole = barge-in/bruit ; fin de parole = « blanc ».

**① Barge-in trop nerveux (Gemini) — adoucissement.** Par défaut, Gemini Live coupe la voix de l'IA « au couteau » dès qu'il détecte un son entrant. Deux leviers (**ciblés Gemini** ; OpenAI gère l'interruption via `conversation.item.truncate`) :
- **VAD moins nerveuse** ([`engines/vad.js`](services/voice-bridge/src/engines/vad.js)) — helper partagé qui injecte `setup.realtimeInputConfig.automaticActivityDetection` dans les **3** bridges Gemini. Défauts : `startOfSpeechSensitivity = START_SENSITIVITY_LOW` + `prefixPaddingMs = 300` (cf. ③ bruit).
- **Fade-out web** ([`packages/shared/src/geminiLive.ts`](packages/shared/src/geminiLive.ts)) — à l'interruption, un `GainNode` maître fait une rampe 100 %→0 en ~120 ms avant de couper les sources. **Démo navigateur uniquement** (le tél coupe via `event:'clear'` Twilio, audio déjà bufferisé donc non « fondable »).

**② Le « blanc » (silence trop long avant que l'IA réponde)** = détection de FIN de tour.
- **OpenAI** ([`engines/openai-vad.js`](services/voice-bridge/src/engines/openai-vad.js)) — défaut **`semantic_vad`** (`eagerness=high` depuis 2026-06-07, prise de parole la plus rapide après une phrase finie ; repli `medium` par env si l'IA coupe des pauses) : un modèle décide quand l'utilisateur a VRAIMENT fini (selon ses mots), pas un délai de silence fixe → répond vite sur une phrase finie, sans couper une pause de réflexion (idéal personnes âgées). Appliqué aux 2 bridges OpenAI voice-bridge (`modect-call-bridge.js` prod + `openai-bridge.js` démo tél) ET au web WebRTC ([`realtime.ts`](packages/shared/src/realtime.ts), hardcodé `medium` car bundle navigateur sans env — **non aligné sur `high`**, couvre démo web + simulation aidant).
- **Gemini** — pas de fin-de-tour sémantique : seuls `endOfSpeechSensitivity` / `silenceDurationMs` jouent. Laissés au défaut Gemini (les durcir risque de couper une pause) → à régler à l'oreille par env.

**③ Bruit d'ambiance pris pour un coupage de parole** = détection de DÉBUT de tour.
- **OpenAI** — **`noise_reduction`** (défaut `far_field`, env) : OpenAI filtre le bruit AVANT la VAD. `far_field` = haut-parleur/pièce (cas fréquent), `near_field` = combiné à l'oreille. En `server_vad`, `threshold` ↑ = exige une voix plus franche.
- **Gemini** — pas de filtre dédié ; `prefixPaddingMs = 300` (vs 200 avant) exige une parole soutenue avant interruption → rejette les bruits brefs.

**④ Le « blanc au démarrage » (silence après le décrochage) — bonjour PROACTIF (≠ VAD).** Le `blank.start_ms` (cf. fluidité) n'est PAS du VAD : c'est le silence entendu juste après le décrochage, avant le 1er mot de l'IA. **Défaut (validé à l'oreille le 2026-06-07) : l'IA salue dès que le setup est prêt, sans attendre.** Le contenu du bonjour vient de la règle n°1 du prompt / `firstMessage` (`firstMessageHint` côté appels planifiés) — pas de « dès que tu entends allô » dans le prompt (le timing est géré en code). Câblé dans les **5 bridges** (appels planifiés [`modect-call-bridge.js`](services/voice-bridge/src/engines/modect-call-bridge.js) + [`modect-gemini-bridge.js`](services/voice-bridge/src/engines/modect-gemini-bridge.js) ET démos [`openai-bridge.js`](services/voice-bridge/src/engines/openai-bridge.js) tél + [`gemini-bridge.js`](services/voice-bridge/src/engines/gemini-bridge.js) tél + [`gemini-bridge-web.js`](services/voice-bridge/src/engines/gemini-bridge-web.js) navigateur) via la constante PARTAGÉE [`engines/greeting.js`](services/voice-bridge/src/engines/greeting.js).
> **PROTECTION DU BONJOUR — « porte micro » (`micGateOpen`).** Problème vécu : l'IA salue, l'interlocuteur dit « allô » par réflexe **par-dessus** → ce « allô » est pris pour un barge-in, coupe le bonjour, et l'IA met ~2 s à reprendre (re-détection de fin de tour sur un mot court). Fix engine-agnostique **côté bridge** : tant que le bonjour d'ouverture n'est pas fini, on **ne transmet PAS** le micro de l'interlocuteur au moteur (on DROP les frames audio) → le moteur n'« entend » pas le « allô », ne s'interrompt pas, le bonjour se déroule en entier. La porte se rouvre dès le **1er `turnComplete` / `response.done`** (filet de sécurité `GREETING_PROTECT_MAX_MS`, défaut 8000, si l'event manquait) → barge-in normal pour tout le reste de l'appel. ⚠️ Conséquence voulue : ce que dit l'interlocuteur *pendant* le bonjour est ignoré (un « allô » réflexe — c'est le but). **Implémenté sur les 5 bridges voice-bridge** : Gemini (`modect-gemini-bridge.js`, `gemini-bridge.js`, `gemini-bridge-web.js`) — porte ouverte au 1er `turnComplete` ; OpenAI (`modect-call-bridge.js`, `openai-bridge.js`) — porte ouverte au 1er `response.done`. (OpenAI a aussi le levier `turn_detection.interrupt_response:false` mais la porte micro est plus simple et uniforme entre moteurs.) Validé à l'oreille sur Gemini le 2026-06-07. **Exception démo navigateur OpenAI** (`realtime.ts`, WebRTC direct) : hors voice-bridge, pas de porte micro. 
> **Mode hybride « attendre le allô » (`GREETING_FALLBACK_MS > 0`) — testé et ABANDONNÉ.** On laissait l'interlocuteur parler en premier ; mais sur un mot court (« allô ? ») le `semantic_vad` hésite → blanc interminable. Défaut `0` = proactif. La porte micro rend ce mode encore plus défunt (la porte fermée empêche la détection de l'« allô ») → conservé uniquement comme délai configurable avant le bonjour. **Exception démo navigateur OpenAI** ([`realtime.ts`](packages/shared/src/realtime.ts), WebRTC direct, partagée avec la simulation aidant) : proactif immédiat, ni porte micro ni hybride (différé).

**Réglages env (voice-bridge / Render)** — surchargeables sans redéploiement (kill-switch côté chaque moteur) :
- **Gemini** : `GEMINI_VAD_DISABLED` · `GEMINI_VAD_START_SENSITIVITY` (défaut `START_SENSITIVITY_LOW`) · `GEMINI_VAD_PREFIX_PADDING_MS` (défaut `300`) · `GEMINI_VAD_END_SENSITIVITY` / `GEMINI_VAD_SILENCE_DURATION_MS` (anti-« blanc », non envoyés par défaut).
- **OpenAI** : `OPENAI_VAD_DISABLED` · `OPENAI_VAD_TYPE` (défaut `semantic_vad`, ou `server_vad`) · `OPENAI_VAD_EAGERNESS` (défaut `high`) · `OPENAI_NOISE_REDUCTION` (défaut `far_field`, ou `near_field`/`off`) · `OPENAI_VAD_THRESHOLD`/`_PREFIX_PADDING_MS`/`_SILENCE_DURATION_MS` (server_vad only).
- **Démarrage (tous les bridges voice-bridge : appels planifiés + démos tél/web Gemini)** : `GREETING_FALLBACK_MS` (**défaut `0` = bonjour proactif immédiat**, validé à l'oreille). `> 0` = mode hybride « attendre le allô » (abandonné, cf. ④). Sauf démo navigateur OpenAI (WebRTC direct, hors voice-bridge).

⚠️ `realtimeInputConfig` (Gemini) et `audio.input.{turn_detection,noise_reduction}` (OpenAI) sont des champs valides et tout reste optionnel (kill-switch) → aucun risque de setup malformé. Barge-in Gemini validé en prod le 2026-06-01. `semantic_vad` + `noise_reduction` + prefix 300 = **à valider à l'oreille** (caveat OpenAI : un retour communautaire signale parfois +latence avec noise_reduction → togglable).

### Observabilité fluidité (Étape 0 — observation pure)
Avant tout réglage automatique, on **mesure**. Un tracker engine-agnostique [`engines/fluidity.js`](services/voice-bridge/src/engines/fluidity.js) accumule pendant l'appel des signaux bruts et écrit un snapshot agrégé en fin d'appel :
- **`calls.fluidity_metrics`** (appels planifiés OpenAI + Gemini) via `recordCallFluidity` ; **`demo_calls.fluidity_metrics`** (démos tél OpenAI/Gemini + web Gemini) via `recordDemoEnd`/`recordDemoRealCost`. Câblé dans les **5 bridges** (`getFluidityMetrics(durationSeconds)`). Pas le web OpenAI WebRTC (hors boucle voice-bridge — différé).
- Contenu : `blank` (latence prise de parole : `start_ms` + `turn_avg/p90/max_ms` + `samples_ms` bruts ; **précis pour OpenAI** via `speech_stopped` ET **pour Gemini TÉLÉPHONE** via une ancre acoustique de fin de parole — détecteur d'énergie local [`engines/endpointing.js`](services/voice-bridge/src/engines/endpointing.js) qui écoute l'audio entrant µ-law et appelle `fluidity.onUserSpeechStop(at)`, **lecture seule** sans toucher au flux Gemini ni à sa VAD ; **`approx=true` ne reste que pour Gemini SANS ancre** = démo web ou kill-switch `GEMINI_ENDPOINT_DISABLED` → proxy transcript qui **SOUS-ESTIME** le « blanc » car la transcription Gemini arrive en retard, collée à la réponse IA. Pourquoi cette ancre : sans elle, /admin/qualite affichait un « blanc » Gemini ~64 ms — artefact, pas la latence perçue. Réglages env endpoint : `GEMINI_ENDPOINT_HANG_MS` (défaut 350, silence→fin de tour) · `GEMINI_ENDPOINT_ONSET_MS` (80) · `GEMINI_ENDPOINT_MIN_RMS` (500). **`blank` ne compte QUE les tours de parole propres** : un gap qui suit immédiatement un barge-in est EXCLU du blanc et rangé dans `barge_in.recovery_*` — sinon la latence d'abandon+régénération après interruption gonflait le blanc, ce qui produisait des max irréalistes ~4 s), `barge_in` (`total`/`per_min`/`suspected_false` = barge-in non suivi de parole = bruit probable ; `recovery_avg/p90/max_ms` + `recovery_samples` = latence de reprise après interruption, mesurée À PART du blanc), `presence_checks` (« allô ? » regex multilingue, null si pas de transcript), `turns` + `assistant_speech_ms` + `speech_ratio`.
- Lecture : CTA « **Qualité** » par appel → modal partagé [`components/FluidityModal.tsx`](apps/web/src/components/FluidityModal.tsx), dans `/admin/appels` onglets passés (si métriques présentes) et Démos vitrine. Aucun ajustement auto — on analyse les chiffres à la main pour décider de l'étape 1 (profil de fluidité par bénéficiaire).

## Back-office aidant (app.aicoute.fr)

SPA React mono-utilisateur. Hypothèse : 95% des aidants n'ont qu'**un seul bénéficiaire**, donc l'architecture est centrée sur **un bénéficiaire sélectionné globalement** (pas de listes navigables).

### Layout commun
- **Sidebar gauche** ([AppLayout.tsx](apps/web/src/components/AppLayout.tsx)) : Tableau de bord / Contexte / Planning / Historique / Veille + section « Mon compte » séparée en bas.
- **Header sticky** ([AppHeader.tsx](apps/web/src/components/AppHeader.tsx)) sur toutes les pages : dropdown bénéficiaire (défaut = 1er, persisté localStorage `modect.selected_beneficiary_id`) + bouton « Nouveau proche ».
- **Bénéficiaire sélectionné** partagé via [useSelectedBeneficiary.tsx](apps/web/src/hooks/useSelectedBeneficiary.tsx) (React Context provisionné dans AppLayout). Les pages Contexte / Planning / Historique / Veille lisent `selected` du context, **pas l'URL**.

### Pages
| Route | Rôle | Composant |
|---|---|---|
| `/dashboard` | Vue d'ensemble (cards par bénéficiaire — à retravailler) | [Dashboard.tsx](apps/web/src/pages/dashboard/Dashboard.tsx) |
| `/contexte` | Profil bénéficiaire en **6 onglets** (Infos / Histoire / Goûts / Personnalité / Configuration IA / **Mémoire**), save inline par section. Onglet Configuration IA = persona/**moteur**/**voix (avec écoute d'échantillons via [VoicePicker.tsx](apps/web/src/components/VoicePicker.tsx), moteur AVANT la voix)**/style/langue + **Prompt de personnalité** (`custom_prompt`, éditable, bouton « Réinitialiser depuis le défaut »). Onglet Mémoire = souvenirs `conversation_memory` consultables/éditables. | [ContextePage.tsx](apps/web/src/pages/contexte/ContextePage.tsx) + [BeneficiaryContextEditor.tsx](apps/web/src/pages/contexte/BeneficiaryContextEditor.tsx) |
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
| `/admin` | Vue d'ensemble : 3 KPI compactes (Aidants/Bénéficiaires · Appels 24h `passés / à venir` calculés sur `scheduled_at` · Coût IA/Twilio 7j) + section **Activité & coûts** (2 graphes recharts — appels+minutes double axe Y, coûts IA+Twilio — avec sélecteur de fréquence 10j/8sem/6mois) + tableau **Coût moyen par minute** (IA/Twilio/total sur 8j/8sem/6mois). Graphes & tableau alimentés par 1 seul fetch des appels `completed` sur 6 mois, bucketisé côté client. | [AdminDashboard.tsx](apps/web/src/pages/admin/AdminDashboard.tsx) |
| `/admin/comptes` | Liste de tous les profils (aidants + admins) avec nb bénéficiaires, nb calls 30j, dernier appel + lien « Gérer ». **Colonnes triables** (tri par défaut = nom de famille A→Z, asc/desc). | [AdminComptes.tsx](apps/web/src/pages/admin/AdminComptes.tsx) |
| `/admin/comptes/:id` | Édition d'un aidant (nom, email, tél, fuseau ; **rôle en lecture seule**) + liste des bénéficiaires rattachés + zone danger « Supprimer le compte » (désactivée s'il a ≥1 bénéficiaire) | [AdminCompteDetail.tsx](apps/web/src/pages/admin/AdminCompteDetail.tsx) |
| `/admin/beneficiaires` | Liste globale + colonne aidant + état `notify_call_report` + alerte si pas de téléphone + lien « Gérer ». **Colonnes triables** (tri par défaut = nom de famille A→Z, asc/desc ; bénéficiaires jamais appelés en bas). | [AdminBeneficiaires.tsx](apps/web/src/pages/admin/AdminBeneficiaires.tsx) |
| `/admin/beneficiaires/:id` | Édition **complète** d'un bénéficiaire (réutilise `BeneficiaryContextEditor`, les 6 onglets de `/contexte`) + **onglet Planning admin-only** (prop `withSchedule` : planning en lecture seule, édition déverrouillée après **confirmation** ; réutilise `ScheduleEditor` avec `caregiverId` = celui du bénéficiaire pour ne pas réattribuer le planning à l'admin) + zone danger « Archiver/Réactiver » et « Effacer définitivement » (confirmation par saisie du nom) | [AdminBeneficiaireDetail.tsx](apps/web/src/pages/admin/AdminBeneficiaireDetail.tsx) |
| `/admin/appels` | **3 onglets** : passés / prévus / **Démos vitrine**. Filtres URL (`?period=`, `?status=`, `?severity=high`). Filtre **Période contextuel** : onglet passés borne `scheduled_at` à `now − X` (libellés « N derniers jours »), onglet prévus à `now + X` (libellés « N prochains jours »). Onglet passés : colonnes Planifié / Effectif + Coût IA + Coût Twilio + CTA **Qualité** (fluidité, si métriques). Actions : « Relancer » missed/failed, « Déclencher maintenant » prévus, « Supprimer » prévus. **Onglet Démos** = logs `demo_calls` (rapatriés de `/track_calls`) lus en direct via la policy `admin_all_demo_calls` (pas de clé) : totaux + table mode/moteur/coûts + CTA Qualité — composant [AdminDemosTab.tsx](apps/web/src/pages/admin/AdminDemosTab.tsx). | [AdminAppels.tsx](apps/web/src/pages/admin/AdminAppels.tsx) |
| `/admin/qualite` | **Stats de fluidité agrégées** (temps réel) sur `calls.fluidity_metrics` **ET `demo_calls.fluidity_metrics`**. Filtres : périmètre (global / par aidant / par bénéficiaire) + période (8 / 30 j) + **Source** (appels réels / démos / les deux ; les démos n'ont pas d'aidant/bénéficiaire → comptées seulement en périmètre Global). KPIs combinés + **comparaison OpenAI vs Gemini** (le « blanc » en conversation est poolé depuis les `samples_ms` bruts de tous les appels du périmètre → vraie distribution ; repère `~` = approx Gemini). Lecture directe `calls` + `demo_calls` (RLS admin). | [AdminQualite.tsx](apps/web/src/pages/admin/AdminQualite.tsx) |
| `/admin/prompt` | Édition du **prompt système par défaut** de la plateforme (table `prompt_templates`). Textarea + légende des variables + bouton « Réinitialiser » (recharge `DEFAULT_PROMPT_TEMPLATE`). Modifier le défaut ne re-propage PAS aux bénéficiaires existants (snapshots). | [AdminPrompt.tsx](apps/web/src/pages/admin/AdminPrompt.tsx) |
| `/admin/sante` | Calls bloqués (`notified` > 5 min · `in_progress` > 30 min · `scheduled` retry > 5 min) + dernier appel terminé + auto-refresh 30s + **section « Veille modèles voix »** (CTA → Edge Fn `model-watch`, recherche web, cf. note Veille plus haut) | [AdminSante.tsx](apps/web/src/pages/admin/AdminSante.tsx) |

**RLS admin** : la migration `20260529000003_admin_role.sql` ajoute une fonction `is_admin()` (SECURITY DEFINER + STABLE) et des policies additives `admin_all_*` qui ouvrent SELECT (et UPDATE/INSERT sur `calls`) à tout admin. Les policies caregiver existantes ne sont pas touchées — les deux jeux sont OU-isés par Postgres. La migration `20260529000010_admin_edit_delete.sql` ajoute en plus les policies `admin_update_beneficiaries` / `admin_delete_beneficiaries` et passe `calls.beneficiary_id` en `ON DELETE CASCADE` (sinon l'effacement définitif d'un bénéficiaire ayant des appels échouerait sur la FK). La migration `20260529000011_admin_delete_calls.sql` ajoute `admin_all_calls_delete` (suppression d'un appel prévu depuis `/admin/appels`). La migration `20260601000001_admin_edit_session_schedules.sql` ajoute `admin_insert/update/delete_session_schedules` (édition du planning depuis l'onglet Planning de `/admin/beneficiaires/:id` — l'admin n'avait que le SELECT via `…0003`).

**Édition / suppression d'un aidant** (`profiles` + `auth.users`) : passe par 2 Edge Functions service-role (`requireAdmin` vérifie le JWT appelant + le rôle), **pas** par la RLS :
- `admin-update-caregiver` — propage le changement d'email à `auth.users.email` (`email_confirm:true`) en plus de `profiles`. Le `role` n'est jamais modifié (lecture seule côté UI).
- `admin-delete-caregiver` — **refuse en 409** si l'aidant a ≥1 bénéficiaire (garde-fou anti-orphelins ; la FK `caregiver_id` est en CASCADE donc sans ce garde-fou la suppression effacerait silencieusement les bénéficiaires), refuse aussi l'auto-suppression, sinon `auth.admin.deleteUser` (cascade → `profiles`).

**Pour rendre un compte admin** : `UPDATE profiles SET role='admin' WHERE email='...'` (CHECK élargi à `caregiver | beneficiary | admin`).

**Action « Relancer »** sur `/admin/appels` : INSERT direct via client supabase (RLS admin autorise) + `supabase.functions.invoke('initiate-call', { body: { call_id } })`. Pas d'Edge Fn dédiée.

**Différé** (non inclus dans ce lot) : impersonate / vue « comme cet aidant », page emails séparée (l'info est déjà sur `calls.report_email_sent_at`).

### Observabilité & robustesse (Lot 4)

- **Table `system_events`** (cf. tables principales) écrite via `_shared/systemEvents.ts` (Edge) ou `persistence/system-events.js` (voice-bridge). Best-effort, jamais bloquant. Lue par la section « Événements système » de `/admin/sante`.
- **Twilio statusCallback** : `POST /scheduled-status` sur le voice-bridge reçoit les transitions Twilio (`no-answer`, `busy`, `failed`, `canceled`, `completed`) et marque le call AICOUTE via `markCallByTwilioStatus`. Permet de détecter un no-answer en quelques secondes au lieu d'attendre 120 s côté passe B. Sur chaque statut terminal, lance aussi `captureTwilioCost(sid)` (fire-and-forget) : le champ `price` d'un appel Twilio est renseigné de façon **asynchrone** (null au moment du `completed`), donc on poll l'API Twilio plusieurs fois avec délai croissant jusqu'à l'obtenir, on convertit en EUR (USD→EUR si besoin) et on écrit `calls.twilio_cost_eur`. Best-effort : si échec, l'UI garde l'estimation par la durée. Pour les appels **antérieurs** à cette capture, endpoint manuel `POST /backfill-twilio-costs` (auth `MODECT_INTERNAL_TOKEN`, body `{limit}`) qui parcourt les `completed` sans `twilio_cost_eur` et récupère leur prix (déjà finalisé → fetch unique sans polling).
- **Vue coûts IA** sur `/admin` : barchart 30 jours + total mensuel, calculé sur `calls.ai_cost_eur_real` (snapshot écrit par le voice-bridge en fin d'appel).
- **Test tronqué** : `npm run test:email-report` (cf. [scripts/test-email-report.mjs](scripts/test-email-report.mjs)) valide la chaîne `save-transcript → generate-summary → email Resend` sans Twilio ni OpenAI Realtime. 30 s, 0 €.
- **Checklist pré-release** : [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) pour les vérifications manuelles qu'aucun test automatique ne couvre (vrai appel Twilio avec audio).

### Compte-rendu partageable (lien public 48h)
L'email post-appel (envoyé par [generate-summary](supabase/functions/generate-summary/index.ts), renvoyé par [resend-report](supabase/functions/resend-report/index.ts)) ne pointe plus vers `/historique/:id` (back-office, login requis) mais vers une **page publique sans login** `/r/:token` ([PublicReport.tsx](apps/web/src/pages/public/PublicReport.tsx), route hors `AuthGuard`, servie sur les deux hôtes). But : partage avec des proches sans compte.
- **Jeton** : `issueReportToken` ([_shared/reportToken.ts](supabase/functions/_shared/reportToken.ts)) écrit `calls.report_token` (aléatoire 32o) + `report_token_expires_at = now+48h`, ré-émis à **chaque** envoi/renvoi (l'ancien lien devient invalide). Base URL surchargeable via env `PUBLIC_REPORT_URL` (défaut `https://www.aicoute.fr`).
- **Données** : la page fetch [get-report](supabase/functions/get-report/index.ts) (`verify_jwt=false`, service-role) → lookup par token + check expiration (404 inconnu / 410 expiré). `calls` n'est PAS ouvert à anon : le token EST le secret, et get-report ne renvoie qu'un sous-ensemble « rapport » (jamais email aidant, coûts, sid Twilio).
- **Destinataires** : l'email part à l'aidant **+** `beneficiaries.report_recipients` (proches), assemblés/dédoublonnés/validés par `normalizeRecipients` (`_shared/email.ts`). Tous en `To:` (un seul email). Gouverné par l'opt-in `notify_call_report`.

### Redirections legacy (dans [App.tsx](apps/web/src/App.tsx))
`/sessions → /planning`, `/reports → /historique`, `/reports/:id → /historique/:id`, `/settings → /compte`, `/beneficiary → /contexte`, `/beneficiary/:id → /contexte` (avec sélection auto), `/memories → /dashboard`, `/setup → /compte`.

### Worker planning + politique no-answer

**Pré-création des calls** : les calls correspondant à chaque créneau récurrent sont pré-créés à l'avance sur un horizon de **15 jours** par [regenerate-future-calls](supabase/functions/regenerate-future-calls/index.ts). Idempotent grâce au UNIQUE constraint `calls(schedule_id, scheduled_at)` (non-partial — cf. Bugs connus). **Auto-correctif** : pour un schedule actif, la fonction **élague d'abord** les `calls` `status='scheduled'` futurs de ce schedule dont le `scheduled_at` n'est plus dans la projection courante (créneaux orphelins après un changement d'heure/de jours), **puis** upsert les bons créneaux. Elle ne touche jamais aux statuts `notified`/`in_progress`/`completed` → un appel `completed` posé sur un créneau futur (appel déclenché en avance) **bloque** définitivement la recréation `scheduled` de ce créneau (slot consommé ; le rouvrir = supprimer la ligne à la main). Déclenché :
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

## Démo vitrine (www.aicoute.fr)
Deux modes (navigateur / téléphone) × deux moteurs (OpenAI / Gemini), accessibles depuis la home (section `#essai`, `apps/web/src/marketing/components/Demo.tsx`). Un toggle `EngineToggle` au-dessus des cartes choisit le moteur, propagé comme prop `engine` aux deux modals et persisté dans `demo_calls.engine`.

L'architecture est **asymétrique** côté web entre les deux moteurs :
- OpenAI web → WebRTC direct navigateur ↔ OpenAI (token éphémère via Edge Fn)
- Gemini web → WebSocket navigateur ↔ voice-bridge ↔ Gemini (proxy serveur, car Gemini n'a pas d'ephemeral token public et la clé Google doit rester serveur)

**Mode 1 — Navigateur (OpenAI)** : `DemoWebModal.tsx` avec `engine='openai'`. Ephemeral token via Edge Fn `public-realtime-token` (rate-limit IP 5/h). Utilise `RealtimeSession` de `@modect/shared`. WebRTC direct vers OpenAI.

**Mode 1bis — Navigateur (Gemini)** : `DemoWebModal.tsx` avec `engine='gemini'`. Ouvre une WS vers `${VITE_VOICE_BRIDGE_URL}/ws/gemini-web` (proxy voice-bridge). Utilise `GeminiLiveSession` de `@modect/shared` qui charge l'AudioWorklet `/gemini-audio-worklet.js` (capture mic → PCM16 16 kHz) et joue les chunks PCM16 24 kHz reçus via un `AudioContext`. Côté serveur : `services/voice-bridge/src/engines/gemini-bridge-web.js` proxy vers Gemini avec vérif d'origine (`ALLOWED_ORIGINS`) + rate-limit IP 5/h (`LIMITS.perIpWeb`).

**Mode 2 — Téléphone (OpenAI ou Gemini)** : `DemoPhoneModal.tsx`. POST le numéro + `engine` vers `${VITE_VOICE_BRIDGE_URL}/call`. Le service crée un appel Twilio, sert un TwiML qui ouvre une WS `/media-stream` ; le `<Parameter name="engine">` propage le choix. Au start de la WS, server.js dispatche vers `engines/openai-bridge.js` (µ-law direct) ou `engines/gemini-bridge.js` (conversion µ-law 8 kHz ↔ PCM16 16/24 kHz via `engines/audio.js`). Rate-limit IP 3/h + numéro 3/24h. Coupure serveur 2 min (`MAX_CALL_SECONDS=120`).

Numéro Twilio prod : `+33 9 39 03 52 69`. Modèle Gemini par défaut surchargeable via env `GEMINI_MODEL` / `GEMINI_VOICE`.

**Tracking des démos** : chaque démo (web ou téléphone, OpenAI ou Gemini) crée une row dans `demo_calls`. Champs : mode, engine, started_at, ended_at, duration_seconds, phone_prefix (6 chars, mode téléphone uniquement), twilio_cost_eur (estim. durée), openai_cost_eur (estim. durée — nom historique, applicable aux deux moteurs), openai_cost_eur_real (coût IA réel par tokens — applicable aux deux moteurs, dispatch tarifs via `computeAiCostEur(engine, tokens)`), tokens_input_audio + tokens_input_audio_cached + tokens_output_audio + tokens_input_text + tokens_output_text (mutualisés ; `input_audio_cached` reste à 0 pour Gemini qui ne facture pas le cache audio). Côté web : `DemoWebModal` appelle l'Edge Function `log-demo` (actions `start`/`end`) → écrit ended_at + duration + estimation par durée. **Coût IA réel (tokens)** : pour le web **Gemini**, les tokens ne sont visibles que côté serveur (proxy `gemini-bridge-web.js`), donc le client propage le `demoId` en query (`/ws/gemini-web?demoId=…`) et le voice-bridge complète `openai_cost_eur_real` + `tokens_*` via `recordDemoRealCost` (colonnes disjointes de log-demo → pas de course). Le web **OpenAI** (WebRTC direct) n'a pas encore ce câblage → seule l'estimation par durée est remontée. Côté téléphone : `services/voice-bridge/src/tracking.js` écrit directement dans Supabase via service role, `demoCallId` propagé via TwiML `<Parameter>`, coût réel inclus. Tarifs : OpenAI ($32/$64 in/out par M tokens) et Gemini ($3/$12) hardcodés dans tracking.js, conversion USD→EUR à 0,92. **Consultable dans `/admin/appels` onglet « Démos vitrine »** ([AdminDemosTab.tsx](apps/web/src/pages/admin/AdminDemosTab.tsx), lecture directe `demo_calls` via policy `admin_all_demo_calls`). _Legacy : l'ancienne page publique `/track_calls` (clé `DEMO_TRACK_KEY` + Edge Function `list-demos`) a été retirée le 2026-06-07 ; la fonction `list-demos` et le secret restent déployés mais ne sont plus utilisés._

## Vitrine — pages de contenu, SEO & prerendering

### Pages publiques hors home (vitrine)
Routes déclarées dans [App.tsx](apps/web/src/App.tsx) hors `AuthGuard`, servies sur les deux hôtes (utiles sur la vitrine) :
- `/a-propos` — [About.tsx](apps/web/src/marketing/About.tsx) (récit « Notre histoire »)
- `/mentions-legales`, `/cgu`, `/rgpd`, `/ia-act` — pages légales dans [src/marketing/legal/](apps/web/src/marketing/legal/)

Toutes réutilisent **[LegalLayout.tsx](apps/web/src/marketing/legal/LegalLayout.tsx)** : barre minimale (logo + « ← Retour à l'accueil »), titre Fraunces, date de MAJ optionnelle, `Footer`, + primitives typo exportées (`Section`/`P`/`UL`/`LI`/`Mail`). Liens internes en `<a>` simple (aucun hook react-router) → composants **SSR-safe**. `document.title` posé via `useEffect`. Contenu légal **adapté** de corraict.com (même société Oaventure EURL) au modèle B2C d'Aicoute (responsable de traitement, sous-traitants OpenAI/Google/Twilio/Resend/Supabase/Render/Netlify, volet données de santé art. 9 + consentement) ; CGU = trame **générique à relire juridiquement**. Ces pages ne sont **pas** prerendues (rendu client, SEO secondaire).

Le **[Footer.tsx](apps/web/src/marketing/components/Footer.tsx)** est partagé home + sous-pages : ses liens-ancres sont en `/#section` (et NON `#section`) pour scroller sur la home ET naviguer-puis-scroller depuis une sous-page. Bloc Légal = Mentions légales/CGU/RGPD/IA Act ; bloc Entreprise = À propos/Contact. (Les ancres nues `#…` restantes du Header/Hero/FAQ sont OK car ces composants ne vivent que sur la home.)

### SEO (vitrine)
- `index.html` : `<title>` + description, `canonical`, **Open Graph + Twitter Card**, **JSON-LD** (`Organization` + `WebSite` + `FAQPage` 8 Q/R), `favicon.svg`, `theme-color`. Ces balises sont statiques → vues par Google ET bots sociaux sans JS. ⚠️ servies aussi sur `app.*` (même index.html) mais sans impact (back-office non indexé).
- `public/robots.txt` (+ `Disallow: /r/`, lien sitemap) + `public/sitemap.xml`.
- **Image OG** `public/og-image.jpg` (1200×630, charte) régénérable via `node scripts/make-og-image.mjs` — script **PONCTUEL, hors build** : `npm i --no-save @resvg/resvg-js sharp` + polices TTF sous-settées Google Fonts (UA Android → TTF, param `&text=` = glyphes de la copie courante uniquement → re-télécharger si la copie change).

### Prerendering SSG de la home
`build` = `vite build && vite build --ssr src/entry-prerender.tsx --outDir dist-ssr && node scripts/prerender.mjs` :
- [entry-prerender.tsx](apps/web/src/entry-prerender.tsx) rend `<Home/>` en HTML via `react-dom/server` (sans navigateur).
- [scripts/prerender.mjs](apps/web/scripts/prerender.mjs) l'injecte dans `dist/index.html`. **Résilient** : en cas d'échec → garde l'index.html SPA (fonctionnel) et n'échoue PAS le build (dégradation SEO-only, jamais un deploy cassé) ; nettoie `dist-ssr` (gitignoré).
- [main.tsx](apps/web/src/main.tsx) : `hydrateRoot` **uniquement** sur la home vitrine pré-rendue (`pathname === '/' && !hostname.startsWith('app.')`) ; sinon `root.replaceChildren()` + `createRoot` (l'index.html servi sur TOUTE route contient le markup home → sans ça, mismatch d'hydratation sur les sous-pages).
- Marche car les composants react-router n'émettent aucun DOM → markup de `<App/>` sur "/" === `<Home/>`. ⚠️ Si la home utilise un jour une valeur non-déterministe au rendu (`Date`/`Math.random`) ou un accès `window`/`document` hors `useEffect`, l'hydratation casse.

## Variables d'environnement

### apps/web (.env) — app unique (vitrine + back-office)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=      # clé publique anon
VITE_APP_URL=https://app.aicoute.fr
VITE_DASHBOARD_URL=          # https://app.aicoute.fr (prod) / vide en local (liens relatifs)
VITE_VOICE_BRIDGE_URL=       # https://voice.aicoute.fr (prod) / vide en local (cache le bouton "Me faire appeler")
```

### Supabase Edge Functions Secrets
```
OPENAI_API_KEY=
RESEND_API_KEY=
FROM_EMAIL=
DEMO_TRACK_KEY=              # secret pour accéder à /track_calls (générer une chaîne longue aléatoire)
VOICE_BRIDGE_URL=            # URL du service Render (ex: https://voice.aicoute.fr) — utilisé par initiate-call pour POST /scheduled-call
MODECT_INTERNAL_TOKEN=       # secret partagé Supabase ↔ voice-bridge pour les appels planifiés (générer via `openssl rand -hex 32`)
PUBLIC_REPORT_URL=           # optionnel — base URL de la page publique de compte-rendu /r/:token (défaut https://www.aicoute.fr)
MODEL_WATCH_MODEL=           # optionnel — modèle OpenAI (Responses API + web_search) pour la veille /admin/sante (défaut gpt-4.1)
```

### services/voice-bridge (.env) — service Render
```
OPENAI_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_NUMBER=+33939035269
ALLOWED_ORIGINS=https://www.aicoute.fr,https://aicoute.fr  # CRITIQUE : doit inclure les origines qui ouvriront /ws/gemini-web
MAX_CALL_SECONDS=120                # démo vitrine
MAX_SCHEDULED_CALL_SECONDS=900      # appels AICOUTE (15 min max)
SCHEDULED_RING_TIMEOUT=30           # sonnerie max Twilio avant raccrochage auto
GREETING_FALLBACK_MS=0       # défaut 0 = bonjour proactif immédiat (validé) ; > 0 = mode hybride « attendre le allô » (abandonné)
GREETING_PROTECT_MAX_MS=8000 # porte micro : durée MAX de protection du bonjour (rouverte au 1er turnComplete sinon)
SUPABASE_URL=                # écriture demo_calls (tracking /track_calls) + calls (appels planifiés)
SUPABASE_SERVICE_ROLE_KEY=   # idem ; si absents → persistance désactivée silencieusement
MODECT_INTERNAL_TOKEN=       # MÊME valeur que côté Supabase ; si absent → /scheduled-call refusé en 503

# --- Gemini Live (optionnel — sans ces vars, l'engine 'gemini' est refusé en 503) ---
GOOGLE_API_KEY=              # clé Google AI Studio (https://aistudio.google.com/apikey)
GEMINI_MODEL=                # défaut : models/gemini-3.1-flash-live-preview ; override si Google publie un nouveau preview label
GEMINI_VOICE=                # FALLBACK voix Gemini si le bénéficiaire n'en a pas (gemini_voice) ; défaut Aoede. Les appels planifiés utilisent désormais la voix par bénéficiaire (ctx.gemini_voice) ; cet env ne sert qu'aux démos vitrine + filet de secours.

# --- VAD / fluidité Gemini (optionnel — cf. « Fluidité de la conversation » plus haut) ---
GEMINI_VAD_DISABLED=         # true → kill-switch, retour au comportement Gemini par défaut
GEMINI_VAD_START_SENSITIVITY=   # défaut : START_SENSITIVITY_LOW
GEMINI_VAD_PREFIX_PADDING_MS=   # défaut : 300 (ms de parole soutenue requis avant interruption ; ↑ = rejette + le bruit)
GEMINI_VAD_END_SENSITIVITY=     # anti-« blanc » (optionnel, non envoyé par défaut ; END_SENSITIVITY_HIGH = fin détectée + tôt)
GEMINI_VAD_SILENCE_DURATION_MS= # anti-« blanc » (optionnel, non envoyé par défaut ; ex. 600-800)

# --- Endpointing Gemini (MESURE du « blanc » téléphone — observation, ne change rien à ce que Gemini entend) ---
GEMINI_ENDPOINT_DISABLED=    # true → kill-switch : retour au proxy transcript (blank approx=true, sous-estimé)
GEMINI_ENDPOINT_HANG_MS=     # défaut 350 : silence continu avant de déclarer la fin de parole
GEMINI_ENDPOINT_ONSET_MS=    # défaut 80 : parole continue avant de confirmer un début (rejette les clics)
GEMINI_ENDPOINT_MIN_RMS=     # défaut 500 : plancher absolu d'énergie (PCM16) pour considérer une frame comme parole

# --- VAD / fluidité OpenAI (optionnel — cf. « Fluidité de la conversation » plus haut) ---
OPENAI_VAD_DISABLED=         # true → kill-switch, retour aux défauts OpenAI
OPENAI_VAD_TYPE=             # défaut : semantic_vad (anti-« blanc ») | server_vad
OPENAI_VAD_EAGERNESS=        # semantic_vad : low|medium|high|auto (défaut high ; ↓ = attend plus)
OPENAI_NOISE_REDUCTION=      # défaut : far_field (haut-parleur) | near_field (combiné) | off
OPENAI_VAD_THRESHOLD=           # server_vad only (défaut 0.5 ; ↑ = exige voix plus franche)
OPENAI_VAD_PREFIX_PADDING_MS=   # server_vad only (défaut 300)
OPENAI_VAD_SILENCE_DURATION_MS= # server_vad only (défaut 500 ; ↓ = répond + vite)
```

## Déploiement
- **Netlify** : **un seul site** (Base directory `apps/web`, `apps/web/netlify.toml`). Faire pointer **les deux domaines** `www.aicoute.fr` + `app.aicoute.fr` vers ce site. L'app route selon le sous-domaine (`src/App.tsx` : `app.*` → back-office, sinon vitrine). `Permissions-Policy: microphone=(self)` pour WebRTC. Penser à whitelister `app.aicoute.fr` dans Supabase → Auth → URL Configuration.
- **Analytics (Umami)** : snippet chargé **conditionnellement** depuis `apps/web/index.html` via un garde inline — uniquement sur la **vitrine** (exclut `app.*` + `localhost`/`127.0.0.1`), pour ne pas tracker le back-office ni le dev local. `data-website-id` Umami Cloud en dur dans `index.html`.
- **Supabase** : `supabase link --project-ref XXX` puis `supabase functions deploy`
- **Render** : Web Service Node pour `services/voice-bridge` (plan **Starter** minimum — le Free dort après 15 min et casse la démo). Région Frankfurt. Custom domain `voice.aicoute.fr` (CNAME). Variables à renseigner dans l'UI Render. Blueprint disponible dans `services/voice-bridge/render.yaml`.
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
- **`verify_jwt=true` rejette la clé service-role en 401** : une Edge Fn appelée en interne par une autre (via `fetch` + `Bearer ${SERVICE_ROLE_KEY}`) doit être en `verify_jwt = false`. Avec `verify_jwt=true`, la passerelle Supabase accepte la clé **anon** mais **rejette la service-role en 401**. Symptôme vécu : `generate-summary` (seule en `verify_jwt=true`) renvoyait 401 à `save-transcript` / `schedule-calls` passe D / `resend-report` → ni compte-rendu ni email, en silence. **Toutes les Edge Fn internes du projet sont en `verify_jwt=false`** (auth gérée en interne).
- **Table créée par migration SQL brute = pas de GRANT** : `CREATE TABLE` + `ENABLE RLS` + policies ne suffit PAS — sans `GRANT SELECT/UPDATE … TO anon, authenticated`, PostgREST renvoie « permission denied for table … » côté client AVANT d'évaluer la RLS (le `service_role` a ses privilèges, donc l'Edge marche et masque le problème). Vécu sur `system_events` (`…0008`) puis `prompt_templates` (`…0005`). Toujours ajouter les GRANTs pour une nouvelle table accédée côté client.
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
supabase functions deploy get-report           # page publique de partage du compte-rendu (/r/:token, sans login)
supabase functions deploy list-openai-models
supabase functions deploy admin-update-caregiver  # édition aidant (propage email → auth.users)
supabase functions deploy admin-delete-caregiver  # suppression aidant (refuse si bénéficiaires)
supabase functions deploy model-watch             # veille modèles voix (OpenAI Responses + web_search, admin only)

# Push migrations
supabase db push

# Voice-bridge (démo téléphone vitrine) — dev local
cd services/voice-bridge && npm run dev
```
