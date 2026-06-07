// Génère les échantillons audio de voix (une phrase par voix) servis dans le
// sélecteur de voix de l'onglet « Configuration IA ».
//
// PONCTUEL, HORS BUILD — à relancer uniquement si on change le catalogue de
// voix ou la phrase. Sortie : apps/web/public/voice-samples/ (à committer).
//
//   OPENAI_API_KEY=sk-... GOOGLE_API_KEY=AIza... \
//     node apps/web/scripts/make-voice-samples.mjs
//
// OpenAI → MP3 via gpt-4o-mini-tts (seul modèle TTS exposant cedar/marin).
// Gemini → WAV (PCM 24 kHz/16-bit mono emballé) via le modèle TTS Gemini.
//
// ⚠️ Catalogue DUPLIQUÉ de packages/shared/src/voices.ts (script .mjs autonome,
// n'importe pas le TS). À garder en phase.

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../public/voice-samples')

const PHRASE =
  "Bonjour, j'espère que vous passez une bonne journée. " +
  "J'avais hâte de prendre de vos nouvelles et de bavarder un moment avec vous."

const OPENAI_VOICES = ['cedar', 'marin', 'coral', 'sage', 'echo', 'ballad']
const GEMINI_VOICES = ['Aoede', 'Sulafat', 'Callirrhoe', 'Kore', 'Charon', 'Orus']

const OPENAI_KEY = process.env.OPENAI_API_KEY
const GOOGLE_KEY = process.env.GOOGLE_API_KEY
const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts'

// --- OpenAI : POST /v1/audio/speech (gpt-4o-mini-tts) → MP3 -----------------
async function genOpenAI(voice) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice,
      input: PHRASE,
      instructions: "Parle d'une voix chaleureuse, douce et posée, comme à une personne âgée que tu apprécies.",
      response_format: 'mp3',
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${voice}: HTTP ${res.status} ${await res.text()}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const path = resolve(OUT_DIR, `openai-${voice}.mp3`)
  await writeFile(path, buf)
  console.log(`✅ openai-${voice}.mp3 (${(buf.length / 1024).toFixed(0)} Ko)`)
}

// --- Gemini : generateContent (TTS) → PCM 24kHz/16-bit mono → WAV -----------
function pcmToWav(pcm, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const blockAlign = (channels * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)            // taille sous-chunk fmt
  header.writeUInt16LE(1, 20)             // PCM
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

async function genGemini(voice) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent?key=${GOOGLE_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PHRASE }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${voice}: HTTP ${res.status} ${await res.text()}`)
  const json = await res.json()
  const b64 = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
  if (!b64) throw new Error(`Gemini ${voice}: pas d'audio dans la réponse`)
  const wav = pcmToWav(Buffer.from(b64, 'base64'))
  const path = resolve(OUT_DIR, `gemini-${voice}.wav`)
  await writeFile(path, wav)
  console.log(`✅ gemini-${voice}.wav (${(wav.length / 1024).toFixed(0)} Ko)`)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  if (OPENAI_KEY) {
    for (const v of OPENAI_VOICES) await genOpenAI(v)
  } else {
    console.warn('⚠️  OPENAI_API_KEY absent → voix OpenAI ignorées')
  }

  if (GOOGLE_KEY) {
    for (const v of GEMINI_VOICES) await genGemini(v)
  } else {
    console.warn('⚠️  GOOGLE_API_KEY absent → voix Gemini ignorées')
  }

  console.log(`\n🎧 Échantillons écrits dans ${OUT_DIR}`)
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exit(1)
})
