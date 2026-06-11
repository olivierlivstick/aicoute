// Fine-tuning fluidité — résolution + cache des paramètres réglables.
//
// Source de vérité des paramètres côté bridge. Trois familles :
//   - WAV (analyse offline du WAV dual-channel — engines/wav-analysis.js)
//   - Gemini VAD live (engines/vad.js)
//   - OpenAI VAD live (engines/openai-vad.js)
//
// Cascade par paramètre : valeur DB (app_settings.fluidity_tuning, si présente +
// valide après clamp) → variable d'env (filet/escape hatch) → défaut codé. Donc DB
// vide = comportement actuel inchangé.
//
// Lecture À CHAUD : un cache en mémoire est rafraîchi périodiquement (startTuningRefresh,
// ~15 s) → l'admin règle depuis /admin/sante et l'effet arrive sans redémarrer Render.
// Les modules VAD/analyse appellent getTuning() au moment de l'appel (pas au chargement).
//
// ⚠️ Le miroir UI (AdminSante → FineTuningSection) doit rester en phase avec DEFS
// (clés, types, bornes, défauts).

import { readFluidityTuning } from './fluidity-diagnostic.js'

const DEFS = {
  // --- Analyse WAV (offline, sans risque sur les appels) ---
  wav_frame_ms:        { env: 'WAV_FRAME_MS',        type: 'int',   def: 20,   min: 5,   max: 50 },
  wav_hang_ms:         { env: 'WAV_HANG_MS',         type: 'int',   def: 250,  min: 50,  max: 1000 },
  wav_onset_ms:        { env: 'WAV_ONSET_MS',        type: 'int',   def: 90,   min: 20,  max: 400 },
  wav_vad_factor:      { env: 'WAV_VAD_FACTOR',      type: 'float', def: 3.5,  min: 1.5, max: 10 },
  wav_vad_min_rms:     { env: 'WAV_VAD_MIN_RMS',     type: 'int',   def: 250,  min: 50,  max: 2000 },
  wav_greeting_min_ms: { env: 'WAV_GREETING_MIN_MS', type: 'int',   def: 400,  min: 100, max: 2000 },
  wav_ai_channel:      { env: 'WAV_AI_CHANNEL',      type: 'enum',  def: null, options: ['0', '1'] }, // null = forcé 1

  // --- Gemini VAD (live — affecte les vrais appels) ---
  gemini_vad_disabled:            { env: 'GEMINI_VAD_DISABLED',            type: 'bool',  def: false },
  gemini_vad_start_sensitivity:   { env: 'GEMINI_VAD_START_SENSITIVITY',   type: 'enum',  def: 'START_SENSITIVITY_LOW', options: ['START_SENSITIVITY_LOW', 'START_SENSITIVITY_HIGH'] },
  gemini_vad_prefix_padding_ms:   { env: 'GEMINI_VAD_PREFIX_PADDING_MS',   type: 'int',   def: 300,  min: 0, max: 2000 },
  gemini_vad_end_sensitivity:     { env: 'GEMINI_VAD_END_SENSITIVITY',     type: 'enum',  def: null, options: ['END_SENSITIVITY_LOW', 'END_SENSITIVITY_HIGH'] },
  gemini_vad_silence_duration_ms: { env: 'GEMINI_VAD_SILENCE_DURATION_MS', type: 'int',   def: null, min: 0, max: 3000 },

  // --- OpenAI VAD (live — affecte les vrais appels) ---
  openai_vad_disabled:            { env: 'OPENAI_VAD_DISABLED',            type: 'bool',  def: false },
  openai_vad_type:                { env: 'OPENAI_VAD_TYPE',                type: 'enum',  def: 'semantic_vad', options: ['semantic_vad', 'server_vad'] },
  openai_vad_eagerness:           { env: 'OPENAI_VAD_EAGERNESS',           type: 'enum',  def: 'high', options: ['low', 'medium', 'high', 'auto'] },
  openai_noise_reduction:         { env: 'OPENAI_NOISE_REDUCTION',         type: 'enum',  def: 'far_field', options: ['far_field', 'near_field', 'off'] },
  openai_vad_threshold:           { env: 'OPENAI_VAD_THRESHOLD',           type: 'float', def: 0.5,  min: 0, max: 1 },
  openai_vad_prefix_padding_ms:   { env: 'OPENAI_VAD_PREFIX_PADDING_MS',   type: 'int',   def: 300,  min: 0, max: 2000 },
  openai_vad_silence_duration_ms: { env: 'OPENAI_VAD_SILENCE_DURATION_MS', type: 'int',   def: 500,  min: 0, max: 3000 },
}

const BOOL_RE = /^(1|true|yes|on)$/i

function clamp(n, min, max) {
  if (min != null && n < min) return min
  if (max != null && n > max) return max
  return n
}

/** Coerce une valeur brute (DB ou env) selon la déf, ou undefined si invalide. */
function coerce(raw, d) {
  if (raw == null || raw === '') return undefined
  switch (d.type) {
    case 'bool':  return typeof raw === 'boolean' ? raw : BOOL_RE.test(String(raw))
    case 'int': {
      const n = parseInt(raw, 10)
      return Number.isFinite(n) ? clamp(n, d.min, d.max) : undefined
    }
    case 'float': {
      const n = parseFloat(raw)
      return Number.isFinite(n) ? clamp(n, d.min, d.max) : undefined
    }
    case 'enum': {
      const s = String(raw)
      return d.options.includes(s) ? s : undefined
    }
    default: return undefined
  }
}

/** Résout TOUS les paramètres en cascade DB → env → défaut. */
export function resolveTuning(dbObj = {}) {
  const out = {}
  for (const [key, d] of Object.entries(DEFS)) {
    let v
    if (Object.prototype.hasOwnProperty.call(dbObj, key)) v = coerce(dbObj[key], d)
    if (v === undefined) v = coerce(process.env[d.env], d)
    if (v === undefined) v = d.def
    out[key] = v
  }
  return out
}

// Cache : initialisé sur env/défauts avant le 1er fetch (sûr si la DB est absente).
let cache = resolveTuning({})

export function getTuning() {
  return cache
}

export async function refreshTuning() {
  try {
    const dbObj = await readFluidityTuning()
    cache = resolveTuning(dbObj || {})
  } catch (err) {
    console.error('[tuning] refresh:', err?.message || err) // garde le cache précédent
  }
  return cache
}

/** Démarre le rafraîchissement périodique du cache (best-effort, non bloquant). */
export function startTuningRefresh(intervalMs = 15000) {
  refreshTuning()
  const t = setInterval(refreshTuning, intervalMs)
  if (t.unref) t.unref()
  return t
}

export { DEFS as TUNING_DEFS }
