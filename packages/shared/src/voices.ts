// Catalogue des voix sélectionnables par bénéficiaire — SOURCE UNIQUE côté web.
//
// Les voix sont SPÉCIFIQUES au moteur :
//   - OpenAI (Realtime GA)  → beneficiaries.ai_voice      (cedar/marin/…)
//   - Gemini Live           → beneficiaries.gemini_voice  (Aoede/Sulafat/…)
// d'où l'ordre dans l'UI : on choisit d'abord le moteur, PUIS la voix.
//
// Échantillons audio : fichiers statiques pré-générés dans
// apps/web/public/voice-samples/ par scripts/make-voice-samples.mjs (qui lit
// ce même catalogue). OpenAI → .mp3 (gpt-4o-mini-tts), Gemini → .wav (PCM 24kHz).
//
// ⚠️ Deno n'importe pas packages/shared → la whitelist + les défauts sont
// DUPLIQUÉS dans supabase/functions/_shared/callContext.ts. À garder en phase.

import type { AIVoice, GeminiVoice } from './types'

export type VoiceGender = 'female' | 'male'

export interface VoiceOption<Id extends string = string> {
  id: Id            // identifiant envoyé au moteur (cedar, Aoede, …)
  label: string     // libellé affiché
  gender: VoiceGender
  description: string
  sample: string    // chemin public de l'échantillon audio
}

// Phrase dite par chaque voix dans les échantillons. NEUTRE EN GENRE (aucun
// adjectif accordé) pour rester crédible quelle que soit la voix. Si on la
// change, relancer make-voice-samples.mjs pour régénérer les fichiers.
export const VOICE_SAMPLE_PHRASE =
  "Bonjour, j'espère que vous passez une bonne journée. " +
  "J'avais hâte de prendre de vos nouvelles et de bavarder un moment avec vous."

export const OPENAI_DEFAULT_VOICE: AIVoice = 'cedar'
export const GEMINI_DEFAULT_VOICE: GeminiVoice = 'Aoede'

export const OPENAI_VOICES: VoiceOption<AIVoice>[] = [
  { id: 'cedar',  gender: 'male',   label: 'Cedar',  description: 'Posée et naturelle, chaleureuse', sample: '/voice-samples/openai-cedar.mp3' },
  { id: 'marin',  gender: 'female', label: 'Marin',  description: 'Claire et douce, rassurante',     sample: '/voice-samples/openai-marin.mp3' },
  { id: 'coral',  gender: 'female', label: 'Coral',  description: 'Douce et amicale',                sample: '/voice-samples/openai-coral.mp3' },
  { id: 'sage',   gender: 'female', label: 'Sage',   description: 'Calme et apaisante',              sample: '/voice-samples/openai-sage.mp3' },
  { id: 'echo',   gender: 'male',   label: 'Echo',   description: 'Chaleureuse et posée',            sample: '/voice-samples/openai-echo.mp3' },
  { id: 'ballad', gender: 'male',   label: 'Ballad', description: 'Douce et expressive',             sample: '/voice-samples/openai-ballad.mp3' },
]

export const GEMINI_VOICES: VoiceOption<GeminiVoice>[] = [
  { id: 'Aoede',      gender: 'female', label: 'Aoede',      description: 'Naturelle et chaleureuse',   sample: '/voice-samples/gemini-Aoede.wav' },
  { id: 'Sulafat',    gender: 'female', label: 'Sulafat',    description: 'Chaleureuse et accueillante', sample: '/voice-samples/gemini-Sulafat.wav' },
  { id: 'Callirrhoe', gender: 'female', label: 'Callirrhoé', description: 'Détendue et posée',           sample: '/voice-samples/gemini-Callirrhoe.wav' },
  { id: 'Kore',       gender: 'female', label: 'Koré',       description: 'Assurée et rassurante',       sample: '/voice-samples/gemini-Kore.wav' },
  { id: 'Charon',     gender: 'male',   label: 'Charon',     description: 'Calme et claire',             sample: '/voice-samples/gemini-Charon.wav' },
  { id: 'Orus',       gender: 'male',   label: 'Orus',       description: 'Posée et solide',             sample: '/voice-samples/gemini-Orus.wav' },
]

export function voicesForEngine(engine: 'openai' | 'gemini'): VoiceOption[] {
  return engine === 'gemini' ? GEMINI_VOICES : OPENAI_VOICES
}

const OPENAI_VOICE_IDS = OPENAI_VOICES.map((v) => v.id)
const GEMINI_VOICE_IDS = GEMINI_VOICES.map((v) => v.id)

// Anciennes voix DB (nova, shimmer…) ramenées vers une voix féminine du catalogue.
const LEGACY_FEMININE = ['marin', 'nova', 'shimmer', 'coral', 'sage']

// Valide une voix OpenAI stockée en base, avec repli sûr (jamais d'erreur).
export function resolveOpenAIVoice(v: string | null | undefined): AIVoice {
  if (v && (OPENAI_VOICE_IDS as string[]).includes(v)) return v as AIVoice
  return LEGACY_FEMININE.includes(v ?? '') ? 'marin' : OPENAI_DEFAULT_VOICE
}

// Valide une voix Gemini stockée en base, avec repli sûr.
export function resolveGeminiVoice(v: string | null | undefined): GeminiVoice {
  if (v && (GEMINI_VOICE_IDS as string[]).includes(v)) return v as GeminiVoice
  return GEMINI_DEFAULT_VOICE
}
