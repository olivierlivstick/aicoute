# Realtime Lab — test conversation gpt-realtime-2

Page web minimaliste pour tester la qualité de la conversation audio avec `gpt-realtime-2` d'OpenAI, directement depuis ton ordinateur. WebRTC, donc faible latence et pas de Twilio.

## Stack

- **Frontend** : page HTML statique avec WebRTC vers OpenAI
- **Backend** : mini-serveur Node.js Express qui génère un *ephemeral token* (pour pas exposer ta vraie clé API au navigateur)
- **Modèle** : `gpt-realtime-2`, voix `cedar`

## Setup en 3 étapes

### 1. Installer les dépendances
```bash
npm install
```

### 2. Créer ton fichier `.env`
Copie `.env.example` vers `.env` et mets ta clé OpenAI :
```
OPENAI_API_KEY=sk-...
```
Tu trouves ta clé sur https://platform.openai.com/api-keys (assure-toi d'avoir activé l'accès à l'API Realtime).

### 3. Lancer
```bash
npm start
```
Puis ouvre **http://localhost:3000** dans Chrome ou Edge (Safari peut avoir des soucis avec certains codecs WebRTC).

## Utilisation

1. Clique sur "Démarrer la conversation"
2. Autorise l'accès au micro
3. Parle. L'IA répond en direct.
4. L'orbe devient bleue quand l'IA t'écoute, dorée quand elle parle.
5. Le transcript s'affiche à droite en live.

## Personnalisation rapide

Tout est dans `server.js`, fonction `/session` :
- `voice` : `cedar`, `marin`, `alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`
- `instructions` : le prompt système (persona de l'IA)
- `turn_detection.silence_duration_ms` : à baisser (ex. 300) pour que l'IA coupe la parole plus vite, ou monter (ex. 800) pour la laisser attendre que tu finisses

## Coût estimé

Environ **0,15 à 0,30 € la minute de conversation** selon le ratio écoute/parole. Une session de test de 10 min ≈ 2-3 €.

## Compatibilité

- ✅ Chrome, Edge, Brave (testés)
- ⚠️ Safari : peut nécessiter `audio/opus` explicite
- ❌ Firefox : support WebRTC partiel pour ce cas d'usage
