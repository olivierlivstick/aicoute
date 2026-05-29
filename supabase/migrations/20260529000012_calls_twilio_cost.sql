-- Migration : coût Twilio RÉEL par appel
--
-- Le voice-bridge récupère le prix exact de l'appel via l'API Twilio
-- (champ `price` de la ressource Call, renseigné de façon asynchrone quelques
-- secondes/minutes après la fin de l'appel) et l'écrit ici, converti en EUR.
--
-- Distinct de l'estimation par la durée affichée côté UI tant que la valeur
-- réelle n'est pas encore remontée. NULL = pas encore récupéré (ou appel non
-- facturé, ex: no-answer).

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS twilio_cost_eur NUMERIC;
