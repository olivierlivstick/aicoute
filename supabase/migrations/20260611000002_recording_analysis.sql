-- Migration : analyse de fluidité « vérité terrain » sur l'enregistrement WAV.
--
-- Le voice-bridge analyse OFFLINE le WAV dual-channel de chaque appel (VAD énergie
-- par canal → vraies latences de tour de parole, barge-in, chevauchements, ratio de
-- parole) et stocke le résultat ici. C'est la mesure de RÉFÉRENCE affichée dans le
-- modal « Qualité » (remplace les chiffres live de calls.fluidity_metrics, conservés
-- en base). Contient aussi les données BRUTES (segments + échantillons de latence)
-- pour des analyses statistiques ultérieures. Cf. engines/wav-analysis.js.

ALTER TABLE calls      ADD COLUMN IF NOT EXISTS recording_analysis JSONB;
ALTER TABLE demo_calls ADD COLUMN IF NOT EXISTS recording_analysis JSONB;
