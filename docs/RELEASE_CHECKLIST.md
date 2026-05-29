# MODECT — Checklist pré-release

À dérouler à la main avant chaque release significative (migration de schéma, refonte du voice-bridge, changement du flux d'appel). Objectif : valider la boucle complète appel planifié → transcript → email rapport, qu'aucun test automatisé ne couvre intégralement.

Tout ce qui peut être testé sans Twilio est dans `scripts/test-email-report.mjs` (cf. § « Test automatique »). Cette checklist se concentre sur la partie Twilio + audio qui demande un humain.

---

## 0. Préparation (5 min)

- [ ] Migrations à jour côté remote : `supabase migration list` montre toutes les locales appliquées
- [ ] Edge Functions déployées : `supabase functions deploy schedule-calls initiate-call get-call-context realtime-token save-transcript generate-summary`
- [ ] Voice-bridge déployé sur Render (commit SHA correspond au main local) → vérifier le tag du dernier deploy dans le dashboard Render
- [ ] Secrets côté Supabase : `MODECT_INTERNAL_TOKEN`, `VOICE_BRIDGE_URL`, `RESEND_API_KEY`, `OPENAI_API_KEY`
- [ ] Secrets côté Render : mêmes que Supabase pour `MODECT_INTERNAL_TOKEN` + `SUPABASE_SERVICE_ROLE_KEY` + `OPENAI_API_KEY` + `TWILIO_*`

## 1. Test automatique chaînage email (30 s, coût ≈ 0,00 €)

```bash
SUPABASE_URL=https://<projet>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-key> \
TEST_CAREGIVER_EMAIL=olivier@oaventure.com \
npm run test:email-report
```

- [ ] Le script affiche `✅ Tout est OK !`
- [ ] L'email rapport arrive dans la boîte mail de l'aidant test
- [ ] Le bénéficiaire test et le call éphémère ont bien été supprimés (le script affiche `→ cleanup OK`)

## 2. Test d'un appel réel programmé (10 min, coût ≈ 0,50 €)

Sur le back-office prod avec ton compte admin :

- [ ] `/contexte` : prends un bénéficiaire de test avec ton vrai numéro de téléphone dans `phone`
- [ ] `/planning` : crée un planning avec un seul jour (aujourd'hui), heure = `now + 2 min`, `calls_per_week=1`, `retry_count=1`, `notify_on_no_answer=true`
- [ ] Attends 2 min — ton téléphone doit sonner
- [ ] Décroche, parle ~30 s avec l'IA, raccroche
- [ ] `/historique` : vérifie qu'un nouveau call apparaît avec statut `completed` + résumé visible
- [ ] `/historique/:id` : transcript présent + alertes éventuelles + bouton « Voir le compte-rendu complet » dans l'email pointe ici
- [ ] Email rapport reçu avec la charte cocon familial (header terracotta, Fraunces sur les titres)

## 3. Test no-answer (5 min, coût ≈ 0,05 €)

Reprend le planning de l'étape 2 :

- [ ] Modifie l'heure pour `now + 2 min`
- [ ] Quand ton téléphone sonne, ne décroche pas — laisse Twilio terminer (~30 s de sonnerie)
- [ ] `/admin/sante` : vérifie que le call passe à `missed` rapidement (en quelques secondes grâce au statusCallback Twilio, sans attendre les 120 s de la passe B)
- [ ] Un retry est créé automatiquement (visible dans `/admin/appels` avec un T2)
- [ ] Email no-answer reçu **uniquement** après que toutes les tentatives ont échoué

## 4. Test admin (2 min)

- [ ] Connecté en tant qu'admin, la section « Administration » apparaît en bas de la sidebar (palette ocre)
- [ ] `/admin` : KPI cohérents (nombre d'aidants ≥ 1, alertes, coûts 7j…)
- [ ] `/admin/appels?period=today&severity=high` : le filtre URL est respecté au chargement
- [ ] `/admin/sante` : auto-refresh visible après 30 s + section événements système non vide (au moins un tick `schedule-calls`)
- [ ] Action « Relancer » fonctionnelle sur un call `missed`/`failed`

## 5. Connecté en tant qu'aidant (pas admin)

- [ ] `/admin` redirige vers `/dashboard`
- [ ] La section sidebar « Administration » n'apparaît PAS

---

## Sortie de release

Si tout coche : push de tag git + annonce. Sinon : ouvrir un ticket de bug avec le numéro de l'étape qui a échoué et le call_id concerné.
