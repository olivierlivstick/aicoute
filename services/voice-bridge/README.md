# MODECT — voice-bridge

Service Node qui fait le pont audio entre **Twilio** (réseau téléphonique) et **OpenAI Realtime GA** pour la démo téléphonique de la vitrine [www.modect.com](https://www.modect.com).

## Rôle

Quand un visiteur clique sur **« Me faire appeler »** sur la home :

1. Le front (`apps/web/.../DemoPhoneModal.tsx`) POST son numéro vers `POST /call`.
2. Ce service crée un appel sortant Twilio vers ce numéro.
3. Quand le destinataire décroche, Twilio frappe `POST /outgoing` → réponse TwiML qui demande d'ouvrir un Media Stream sur `wss://<host>/media-stream`.
4. Le WebSocket relaie l'audio µ-law dans les deux sens entre Twilio et `wss://api.openai.com/v1/realtime?model=gpt-realtime-2`.

Aucune base de données, aucun frontend ici. Pour le mode démo **navigateur** (WebRTC direct), voir la Edge Function Supabase `public-realtime-token`.

## Endpoints

| Méthode | Chemin | Usage |
|---|---|---|
| GET  | `/health` | Health check (Render) |
| POST | `/call` | `{ phoneNumber }` → déclenche un appel sortant Twilio |
| ANY  | `/outgoing` | TwiML servi à Twilio quand le destinataire décroche |
| WSS  | `/media-stream` | Pont audio µ-law Twilio ↔ OpenAI |

## Variables d'environnement

Voir `.env.example`. Les variables obligatoires sont :

- `OPENAI_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_NUMBER` (numéro Twilio E.164 — actuellement `+33939035269`)
- `ALLOWED_ORIGINS` (CORS, ex : `https://www.modect.com,https://modect.com`)
- `MAX_CALL_SECONDS` (filet de sécurité, défaut 240)

## Dev local

```bash
cd services/voice-bridge
npm install
cp .env.example .env  # remplir les valeurs
npm run dev
```

Pour tester le déclenchement d'appel **sans Twilio réel**, on ne peut pas. Twilio doit pouvoir joindre le service en HTTPS public — utiliser `ngrok http 5050` en dev si on veut tester de bout en bout localement, et passer `TWILIO_NUMBER` à Render quand on déploie.

En **prod**, aucun ngrok : Render expose directement le service.

## Déploiement Render

1. **Créer un Web Service** sur Render (Node) pointant sur ce dossier (`services/voice-bridge`).
2. **Build Command** : `npm install`
3. **Start Command** : `npm start`
4. **Health Check Path** : `/health`
5. **Variables d'environnement** : copier celles de `.env.example` dans l'UI Render.
6. **Custom domain** : ajouter `voice.modect.com` (CNAME vers `<service>.onrender.com`).
7. Une fois déployé, mettre à jour `VITE_VOICE_BRIDGE_URL` dans les variables Netlify d'`apps/web`.

⚠️ **Important** : Render Free Tier coupe les services inactifs après 15 min. Pour la démo, prendre au minimum **Starter** (~7 $/mois) afin que les WebSockets restent ouvrables instantanément.

## Sécurité

- **Rate limit** par IP (3 appels/h) et par numéro destinataire (3 appels/24h) — empêche le harcèlement et limite la facture en cas d'abus.
- **CORS** verrouillé sur les origines explicitement listées.
- **Coupure serveur** à `MAX_CALL_SECONDS` (240 s par défaut) — même si Twilio ou OpenAI bug, l'appel se termine.
- **Numéros loggés masqués** (`+33 6•• ••• •78`) pour éviter de stocker des numéros complets en clair dans les logs.

## Coûts

Par démo (~3 min) :
- Twilio FR mobile sortant : ~0,09 €
- OpenAI Realtime : ~0,60 €
- **Total : ~0,70 € par démo téléphonique**
