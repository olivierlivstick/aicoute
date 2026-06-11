-- Migration : snapshot des réglages de fine-tuning ACTIFS au moment de l'appel.
--
-- Les seuils de fluidité sont désormais réglables à chaud (app_settings.fluidity_tuning,
-- cf. 20260611000003). Pour le calibrage, il faut savoir AVEC QUEL réglage un appel
-- donné a tourné. Le voice-bridge fige donc `getTuning()` au DÉMARRAGE de l'appel
-- (pas à la fin : sinon un changement de réglage juste après le raccrochage serait
-- attribué à tort à l'appel précédent). Affiché dans le modal « Qualité ».
--
-- Les seuils d'ANALYSE WAV restent, eux, dans recording_analysis.vad (figés au moment
-- de l'analyse, et re-figés si on ré-analyse). tuning_snapshot = réglages LIVE de la
-- conversation (VAD Gemini/OpenAI) au début de l'appel.

ALTER TABLE calls      ADD COLUMN IF NOT EXISTS tuning_snapshot JSONB;
ALTER TABLE demo_calls ADD COLUMN IF NOT EXISTS tuning_snapshot JSONB;
