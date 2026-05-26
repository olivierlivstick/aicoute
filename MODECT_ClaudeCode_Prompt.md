# MODECT — Prompt Claude Code (Version complète)

---

## 🎯 CONTEXTE DU PROJET

Tu vas développer **MODECT**, une application SaaS de compagnon conversationnel par IA, destinée aux personnes âgées ou socialement isolées. Un proche (l'**aidant**) s'inscrit sur le service, crée un profil pour son proche (le **bénéficiaire**), configure des sessions de conversation automatiques, et reçoit un compte-rendu après chaque appel. Le bénéficiaire reçoit des appels vocaux IA sur son smartphone, avec une voix naturelle et une mémoire des conversations passées.

---

## 🏗️ STACK TECHNIQUE IMPOSÉ

- **Frontend** : React (Vite), TypeScript, TailwindCSS, Shadcn/ui
- **Base de données & Auth** : Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Voix temps réel** : LiveKit (LiveKit Cloud ou self-hosted) + OpenAI Realtime API (gpt-4o-realtime-preview)
- **Notifications push** : Expo Push Notifications (si mobile natif) OU Firebase Cloud Messaging via Supabase Edge Functions
- **Emails transactionnels** : Resend (ou SendGrid) appelé depuis Supabase Edge Functions
- **Hébergement frontend** : Vercel (ou Supabase Hosting)
- **Langue par défaut de l'UI** : Français

---

## 📁 STRUCTURE DU PROJET

```
modect/
├── apps/
│   ├── web/                          # Dashboard aidant (React + Vite)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   │   ├── auth/             # Login, Register, Forgot password
│   │   │   │   ├── dashboard/        # Vue d'ensemble aidant
│   │   │   │   ├── beneficiary/      # Création/édition profil bénéficiaire
│   │   │   │   ├── sessions/         # Planification des sessions
│   │   │   │   ├── reports/          # Historique et comptes-rendus
│   │   │   │   └── settings/         # Paramètres compte
│   │   │   ├── lib/
│   │   │   │   ├── supabase.ts
│   │   │   │   ├── livekit.ts
│   │   │   │   └── utils.ts
│   │   │   └── hooks/
│   ├── mobile/                       # App bénéficiaire (React Native / Expo)
│   │   ├── app/
│   │   │   ├── (tabs)/
│   │   │   │   ├── index.tsx         # Écran principal "Appel en cours / Attente"
│   │   │   │   └── history.tsx       # Historique simplifié des appels
│   │   │   ├── call.tsx              # Interface d'appel LiveKit
│   │   │   └── _layout.tsx
│   │   └── components/
├── supabase/
│   ├── migrations/                   # Tous les fichiers SQL de migration
│   ├── functions/
│   │   ├── schedule-calls/           # Cron job : déclenchement des sessions planifiées
│   │   ├── initiate-call/            # Crée une room LiveKit + prépare le contexte IA
│   │   ├── livekit-webhook/          # Reçoit les webhooks LiveKit (fin de call, etc.)
│   │   ├── generate-summary/         # Appelle GPT-4 pour générer le compte-rendu
│   │   └── realtime-agent/           # Agent LiveKit qui pilote OpenAI Realtime API
│   └── seed.sql
└── packages/
    └── shared/                       # Types TypeScript partagés
```

---

## 🗄️ SCHÉMA DE BASE DE DONNÉES SUPABASE

Crée les migrations SQL suivantes dans `supabase/migrations/` :

### Table `profiles` (extension de auth.users)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('caregiver', 'beneficiary')),
  avatar_url TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'Europe/Paris',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: chaque utilisateur ne voit que son propre profil
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_profile" ON profiles USING (auth.uid() = id);
```

### Table `beneficiaries`
```sql
CREATE TABLE beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Informations personnelles
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_year INT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  phone TEXT,                          -- Numéro pour les notifications push
  push_token TEXT,                     -- Token Expo/FCM
  
  -- Contexte biographique (rempli par l'aidant)
  family_history TEXT,                 -- Histoire familiale (enfants, petits-enfants, etc.)
  life_story TEXT,                     -- Résumé de vie (métier, lieux vécus, anecdotes)
  hobbies TEXT,                        -- Activités et loisirs préférés
  favorite_topics TEXT,                -- Sujets de conversation appréciés
  topics_to_avoid TEXT,                -- Sujets à éviter absolument
  personality_notes TEXT,              -- Traits de caractère, humeur générale
  health_notes TEXT,                   -- Notes générales de santé (pas médical)
  language_preference TEXT DEFAULT 'fr', -- Langue des conversations
  
  -- Paramètres de l'agent IA
  ai_voice TEXT DEFAULT 'alloy',       -- Voix OpenAI (alloy, echo, fable, onyx, nova, shimmer)
  ai_persona_name TEXT DEFAULT 'Marie', -- Prénom donné au compagnon IA
  conversation_style TEXT DEFAULT 'warm', -- warm | playful | calm | formal
  
  -- Statut
  is_active BOOLEAN DEFAULT TRUE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "caregiver_owns" ON beneficiaries USING (caregiver_id = auth.uid());
```

### Table `session_schedules` (planification récurrente)
```sql
CREATE TABLE session_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Récurrence (format cron simplifié)
  days_of_week INT[] NOT NULL,         -- [2, 4] = mardi et jeudi (0=dim, 1=lun, ...)
  time_of_day TIME NOT NULL,           -- ex: '10:00:00'
  timezone TEXT DEFAULT 'Europe/Paris',
  
  -- Durée et contenu
  max_duration_minutes INT DEFAULT 15,
  suggested_topics TEXT[],             -- Sujets suggérés pour cette planification
  special_instructions TEXT,           -- Instructions spéciales pour l'agent
  
  is_active BOOLEAN DEFAULT TRUE,
  next_scheduled_at TIMESTAMPTZ,       -- Calculé automatiquement
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE session_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "caregiver_owns_schedule" ON session_schedules USING (caregiver_id = auth.uid());
```

### Table `calls` (historique des appels)
```sql
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id),
  schedule_id UUID REFERENCES session_schedules(id),
  
  -- LiveKit
  livekit_room_name TEXT UNIQUE,
  livekit_room_sid TEXT,
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'notified', 'in_progress', 'completed', 'missed', 'failed')),
  
  -- Timing
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INT,
  
  -- Contenu
  transcript JSONB,                    -- [{role: 'user'|'assistant', text: '...', timestamp: ...}]
  raw_audio_url TEXT,                  -- URL Supabase Storage (optionnel)
  
  -- Compte-rendu
  summary TEXT,                        -- Résumé généré par GPT-4
  mood_detected TEXT,                  -- 'positive' | 'neutral' | 'concerned'
  key_topics TEXT[],                   -- Thèmes abordés
  alerts TEXT[],                       -- Signaux d'alerte détectés
  report_available BOOLEAN DEFAULT FALSE,   -- Compte-rendu prêt à lire dans le back office
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
-- L'aidant voit tous les calls de ses bénéficiaires
CREATE POLICY "caregiver_sees_calls" ON calls
  USING (beneficiary_id IN (
    SELECT id FROM beneficiaries WHERE caregiver_id = auth.uid()
  ));
```

### Table `conversation_memory` (mémoire long-terme)
```sql
CREATE TABLE conversation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
  
  memory_type TEXT NOT NULL CHECK (memory_type IN ('fact', 'preference', 'event', 'mood', 'topic')),
  content TEXT NOT NULL,               -- ex: "Aime les émissions de jardinage"
  source_call_id UUID REFERENCES calls(id),
  importance INT DEFAULT 5,            -- 1 à 10
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE conversation_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "caregiver_owns_memory" ON conversation_memory
  USING (beneficiary_id IN (
    SELECT id FROM beneficiaries WHERE caregiver_id = auth.uid()
  ));
```

---

## ⚡ SUPABASE EDGE FUNCTIONS

### 1. `schedule-calls` (Cron toutes les minutes)
```
Rôle : Vérifier si des sessions doivent être déclenchées maintenant.
- Lire toutes les session_schedules actives
- Comparer next_scheduled_at avec NOW()
- Si dû, créer un enregistrement dans calls (status='scheduled')
- Appeler la fonction initiate-call
- Recalculer next_scheduled_at pour la prochaine occurrence
```

### 2. `initiate-call`
```
Rôle : Préparer et lancer un appel.
Input: { call_id: string }
Actions:
  1. Récupérer le call + bénéficiaire + mémoires des 5 derniers appels
  2. Construire le system prompt de l'agent (voir section SYSTEM PROMPT)
  3. Créer une room LiveKit via l'API LiveKit REST
  4. Générer un token LiveKit pour le bénéficiaire (participant "user")
  5. Générer un token LiveKit pour l'agent (participant "agent")
  6. Mettre à jour calls.status = 'notified', calls.livekit_room_name
  7. Envoyer la notification push au bénéficiaire avec l'URL de la room
  8. Lancer l'edge function realtime-agent (en background)
```

### 3. `realtime-agent`
```
Rôle : Agent LiveKit qui connecte OpenAI Realtime API à la room LiveKit.
- Utiliser le SDK @livekit/agents (Node.js) ou équivalent
- Se connecter à la room LiveKit en tant que participant "agent"
- Ouvrir une connexion WebSocket avec OpenAI Realtime API (gpt-4o-realtime-preview)
- Injecter le system prompt avec contexte bénéficiaire + mémoires
- Relayer l'audio bidirectionnel entre LiveKit et OpenAI
- Capturer la transcription en temps réel
- À la fin de la session (timeout ou déconnexion utilisateur):
  * Sauvegarder le transcript dans calls.transcript
  * Appeler generate-summary
  * Mettre calls.status = 'completed'
```

### 4. `generate-summary`
```
Rôle : Générer un compte-rendu structuré de l'appel.
Input: { call_id: string }
Actions:
  1. Récupérer le transcript
  2. Appeler GPT-4o (API standard) avec prompt :
     "Analyse cette conversation entre un compagnon IA et une personne âgée.
      Génère en JSON : {
        summary: string (3-5 phrases, ton bienveillant),
        mood_detected: 'positive'|'neutral'|'concerned',
        key_topics: string[],
        memorable_moments: string[],
        alerts: string[] (signaux inquiétants : solitude excessive, santé, etc.),
        new_memories: [{type, content, importance}]
      }"
  3. Sauvegarder les résultats dans calls
  4. Insérer les new_memories dans conversation_memory
  5. Mettre à jour calls.status = 'completed' et marquer le compte-rendu comme disponible (report_available = TRUE)
```

### 5. `livekit-webhook`
```
Rôle : Recevoir les événements LiveKit (room_finished, participant_left, etc.)
- Vérifier la signature du webhook
- Sur room_finished : mettre à jour call.ended_at, duration_seconds
- Sur participant_left (bénéficiaire) : déclencher la fin propre de l'appel
```

---

## 🤖 SYSTEM PROMPT DE L'AGENT IA

Dans `initiate-call`, construire dynamiquement ce system prompt :

```
Tu es {ai_persona_name}, un compagnon bienveillant et chaleureux qui appelle {first_name} pour bavarder.
Tu parles en {language_preference}, avec un ton {conversation_style}.

INFORMATIONS SUR {first_name} :
- Né(e) en {birth_year}, {gender}
- Histoire familiale : {family_history}
- Sa vie : {life_story}
- Ce qu'il/elle aime faire : {hobbies}
- Sujets de conversation préférés : {favorite_topics}
- À NE PAS aborder : {topics_to_avoid}
- Notes de personnalité : {personality_notes}

CE QUE TU TE RAPPELLES DES DERNIERS APPELS :
{conversation_memory items, triés par importance}

SUJETS SUGGÉRÉS POUR CET APPEL :
{suggested_topics}

INSTRUCTIONS :
- Commence toujours par dire bonjour chaleureusement et demander comment {first_name} va.
- Pose des questions ouvertes, laisse parler, ne coupe pas.
- Évoque naturellement les souvenirs partagés lors d'appels précédents.
- Durée cible : {max_duration_minutes} minutes. Conclus naturellement.
- En cas de détresse manifeste, rassure et suggère gentiment d'appeler un proche.
- Tu n'es PAS un assistant IA généraliste : tu es UN compagnon de conversation, pas un moteur de recherche.
- NE mentionne JAMAIS que tu es une IA sauf si {first_name} le demande explicitement.
```

---

## 📱 APPLICATION MOBILE (Expo / React Native)

### Écran principal (`index.tsx`)
- Design épuré, grandes polices (accessibilité)
- Afficher : "Bonjour {prénom} ! Votre prochain appel est {jour} à {heure}"
- Bouton "Rappeler maintenant" (appel à la demande, optionnel)
- Indicateur de connexion

### Écran d'appel (`call.tsx`)
- Interface minimaliste : avatar animé du compagnon IA (onde sonore)
- Prénom du compagnon bien visible
- Bouton ROUGE "Raccrocher" très visible (accessibilité senior)
- Indicateur "En train de parler..." / "En train d'écouter..."
- Intégrer `@livekit/react-native-webrtc` et `@livekit/react-native`

### Gestion des notifications push
- Utiliser Expo Notifications
- À la réception d'une notification "Votre compagnon vous appelle !", ouvrir directement l'écran call.tsx avec le token LiveKit reçu dans la payload

---

## 🖥️ DASHBOARD WEB AIDANT (React + Vite)

### Design général
- Palette : tons doux et rassurants (bleu-vert pâle, blanc cassé, accents dorés)
- Police : Playfair Display pour les titres, Source Sans Pro pour le corps
- Responsive (mobile-first)

### Page d'accueil / Dashboard
- Carte par bénéficiaire : dernière activité, prochain appel planifié, humeur du dernier appel (emoji)
- Badge de notification si un nouveau compte-rendu est disponible et non lu
- Alertes éventuelles en rouge/orange
- Bouton "Lancer un appel maintenant"

### Page "Profil du bénéficiaire"
Formulaire en plusieurs étapes (wizard) :
1. **Infos de base** : prénom, nom, année de naissance, photo
2. **Son histoire** : histoire familiale, résumé de vie (champs textarea longs)
3. **Ses goûts** : loisirs, sujets préférés, sujets à éviter
4. **Sa personnalité** : notes libres sur son caractère
5. **Configuration IA** : choix de la voix, prénom du compagnon, style de conversation
6. **Téléphone** : numéro + instructions d'installation de l'app mobile

### Page "Planification"
- Interface calendrier hebdomadaire (drag & drop les créneaux)
- Formulaire : jours de la semaine (checkboxes), heure, durée max, sujets suggérés
- Toggle activer/désactiver chaque planning

### Page "Historique & Rapports"
- Liste des appels passés avec : date, durée, humeur (emoji), statut
- Badge **"Nouveau"** sur les comptes-rendus non encore lus par l'aidant (ajouter colonne `report_read_at TIMESTAMPTZ` dans `calls`)
- Indicateur visuel clair quand un compte-rendu est disponible (icône + surbrillance)
- Cliquer sur un appel → vue détaillée :
  * Résumé narratif
  * Thèmes abordés (tags)
  * Moments mémorables
  * Alertes (si présentes)
  * Transcript complet (expandable)

### Page "Mémoires"
- Tableau de toutes les `conversation_memory` du bénéficiaire
- Pouvoir ajouter manuellement, supprimer, modifier l'importance
- Organisé par type : faits, préférences, événements, humeurs

---

## 🔐 AUTHENTIFICATION

- Supabase Auth (email/password + Magic Link)
- À l'inscription : choisir son rôle (par défaut : caregiver)
- Trigger SQL `handle_new_user()` : créer automatiquement le profil dans `profiles`
- Routes protégées côté React avec un `AuthGuard` component
- L'app mobile a son propre flow d'authentification simplifié (code PIN ou biométrie) lié au compte bénéficiaire créé par l'aidant

---

## 🔑 VARIABLES D'ENVIRONNEMENT REQUISES

```env
# Supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# LiveKit
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_URL=wss://your-project.livekit.cloud

# OpenAI
OPENAI_API_KEY=

# App
VITE_APP_URL=https://app.modect.app
```

---

## 📦 DÉPENDANCES PRINCIPALES

### Web (apps/web)
```json
{
  "react": "^18",
  "react-router-dom": "^6",
  "@supabase/supabase-js": "^2",
  "@supabase/auth-ui-react": "^0.4",
  "livekit-client": "^2",
  "@livekit/components-react": "^2",
  "tailwindcss": "^3",
  "@shadcn/ui": "latest",
  "react-hook-form": "^7",
  "zod": "^3",
  "date-fns": "^3",
  "react-calendar": "^4",
  "recharts": "^2",
  "lucide-react": "latest"
}
```

### Mobile (apps/mobile)
```json
{
  "expo": "~51",
  "expo-notifications": "~0.28",
  "expo-router": "~3",
  "@livekit/react-native": "^2",
  "@livekit/react-native-webrtc": "^118",
  "@supabase/supabase-js": "^2",
  "react-native-url-polyfill": "^2"
}
```

### Supabase Functions
```json
{
  "@livekit/agents": "^0.5",
  "@livekit/rtc-node": "^0.9",
  "openai": "^4"
}
```

---

## ✅ ORDRE DE DÉVELOPPEMENT RECOMMANDÉ

1. **Migrations Supabase** : créer toutes les tables + RLS + triggers
2. **Auth** : flow inscription/connexion web + création de profil
3. **CRUD Bénéficiaire** : wizard de création de profil complet
4. **CRUD Planification** : interface calendrier + sauvegarde
5. **Edge Function `initiate-call`** : création room LiveKit + system prompt
6. **Edge Function `realtime-agent`** : agent voix LiveKit ↔ OpenAI Realtime
7. **App Mobile** : écran d'appel + gestion notifications push
8. **Edge Function `generate-summary`** : génération du compte-rendu, disponible dans le back office
9. **Edge Function `schedule-calls`** : cron automatique
10. **Dashboard rapports** : affichage historique + comptes-rendus (avec badge "Nouveau")
12. **Page Mémoires** : gestion manuelle des souvenirs
13. **Polish UI/UX** : responsive, accessibilité, animations

---

## 🎨 IDENTITÉ VISUELLE MODECT

- **Nom** : MODECT (MOment, DEcouverte, ConTact)
- **Baseline** : "La présence qui réchauffe"
- **Logo** : une onde sonore stylisée formant un cœur
- **Couleurs primaires** : #2D6A9F (bleu confiance) + #F4A261 (orange chaleur)
- **Couleurs secondaires** : #E8F4FD (bleu très pâle) + #FFF8F0 (crème)
- **Police titres** : Playfair Display (serif, élégant, rassurant)
- **Police corps** : Source Sans 3 (lisible, accessible)
- **Ton de communication** : bienveillant, chaleureux, simple, jamais technique

---

## ⚠️ POINTS D'ATTENTION CRITIQUES

1. **Accessibilité senior** : dans l'app mobile, taille de police minimum 18px, boutons très larges (min 60px), contraste élevé, pas de gestes complexes
2. **Confidentialité** : les transcriptions et données personnelles sont sensibles — RLS strict, chiffrement en transit, mention RGPD obligatoire
3. **Gestion des erreurs d'appel** : si le bénéficiaire ne répond pas, mettre calls.status='missed', notifier l'aidant par email
4. **Timeout** : l'agent IA doit terminer proprement l'appel après max_duration_minutes même si la conversation continue
5. **Coûts API** : limiter la durée des appels (configurable par l'aidant), monitorer l'usage OpenAI
6. **Fallback voix** : si OpenAI Realtime API indisponible, prévoir un message d'excuse automatique au bénéficiaire
7. **RGPD** : consentement explicite, droit à l'effacement, pas de partage de données tiers
```
