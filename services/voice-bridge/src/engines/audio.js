// Conversions audio pour le pont Twilio (µ-law 8kHz) ↔ Gemini (PCM16 16/24kHz).
//
// OpenAI accepte µ-law en natif → AUCUNE conversion nécessaire pour openai-bridge.
// Ce module n'est utilisé que par gemini-bridge.
//
// Implémentation G.711 µ-law standard + resampling linéaire simple :
//   - Upsampling 8→16 kHz : duplication + moyenne (interpolation linéaire)
//   - Downsampling 24→8 kHz : moyenne de 3 échantillons (anti-aliasing cru,
//     suffisant pour téléphonie qui filtre tout > 4 kHz côté Twilio de toute façon)
//
// Aucun dep externe : code G.711 maison (~30 lignes), évite wavefile et compagnie.

const MULAW_BIAS = 0x84
const MULAW_CLIP = 32635

// --- G.711 µ-law ↔ PCM16 (échantillon unique) -------------------------------

function mulawByteToPcm16Sample(mu) {
  mu = ~mu & 0xFF
  const sign     = mu & 0x80
  const exponent = (mu >> 4) & 0x07
  const mantissa = mu & 0x0F
  let sample = ((mantissa << 3) + MULAW_BIAS) << exponent
  sample -= MULAW_BIAS
  return sign ? -sample : sample
}

function pcm16SampleToMulawByte(pcm) {
  let sign = 0
  if (pcm < 0) { sign = 0x80; pcm = -pcm }
  if (pcm > MULAW_CLIP) pcm = MULAW_CLIP
  pcm += MULAW_BIAS
  let exponent = 7
  for (let mask = 0x4000; (pcm & mask) === 0 && exponent > 0; mask >>= 1) exponent--
  const mantissa = (pcm >> (exponent + 3)) & 0x0F
  return ~(sign | (exponent << 4) | mantissa) & 0xFF
}

// --- Conversions buffer-level ------------------------------------------------

/** Buffer µ-law → Int16Array PCM 8 kHz */
function decodeMulaw(buf) {
  const out = new Int16Array(buf.length)
  for (let i = 0; i < buf.length; i++) out[i] = mulawByteToPcm16Sample(buf[i])
  return out
}

/** Int16Array PCM 8 kHz → Buffer µ-law */
function encodeMulaw(pcm) {
  const out = Buffer.alloc(pcm.length)
  for (let i = 0; i < pcm.length; i++) out[i] = pcm16SampleToMulawByte(pcm[i])
  return out
}

/** Upsample 8 kHz → 16 kHz par interpolation linéaire (×2) */
function upsample8to16(pcm8) {
  const out = new Int16Array(pcm8.length * 2)
  for (let i = 0; i < pcm8.length; i++) {
    const a = pcm8[i]
    const b = i + 1 < pcm8.length ? pcm8[i + 1] : a
    out[i * 2]     = a
    out[i * 2 + 1] = (a + b) >> 1
  }
  return out
}

/** Downsample 24 kHz → 8 kHz par moyenne 3-samples (low-pass anti-alias léger) */
function downsample24to8(pcm24) {
  const outLen = Math.floor(pcm24.length / 3)
  const out = new Int16Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const idx = i * 3
    out[i] = ((pcm24[idx] + pcm24[idx + 1] + pcm24[idx + 2]) / 3) | 0
  }
  return out
}

/** Buffer little-endian PCM16 → Int16Array (copie défensive si non-aligné) */
function pcm16BufferToInt16(buf) {
  // Buffer Node : .buffer peut pointer sur un pool partagé plus large.
  // On bornnage explicitement avec byteOffset / byteLength.
  if (buf.byteOffset % 2 === 0) {
    return new Int16Array(buf.buffer, buf.byteOffset, buf.length >> 1)
  }
  // Fallback : recopie pour aligner sur 2 bytes (rare en pratique)
  const copy = Buffer.from(buf)
  return new Int16Array(copy.buffer, copy.byteOffset, copy.length >> 1)
}

/** Int16Array → Buffer little-endian PCM16 */
function int16ToPcm16Buffer(pcm) {
  return Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)
}

// --- API haut niveau : base64 ↔ base64 (utilisé par gemini-bridge) ----------

/**
 * Chaîne Twilio µ-law base64 (8 kHz) → Gemini PCM16 base64 (16 kHz, LE).
 * Twilio envoie ~160 bytes µ-law par paquet (20ms) → 640 bytes PCM16 après upsample.
 */
export function mulawB64ToPcm16B64At16k(b64) {
  const mulaw = Buffer.from(b64, 'base64')
  const pcm8  = decodeMulaw(mulaw)
  const pcm16 = upsample8to16(pcm8)
  return int16ToPcm16Buffer(pcm16).toString('base64')
}

/**
 * Chaîne Gemini PCM16 base64 (24 kHz, LE) → Twilio µ-law base64 (8 kHz).
 */
export function pcm24B64ToMulawB64At8k(b64) {
  const buf   = Buffer.from(b64, 'base64')
  const pcm24 = pcm16BufferToInt16(buf)
  const pcm8  = downsample24to8(pcm24)
  return encodeMulaw(pcm8).toString('base64')
}

/**
 * Twilio µ-law base64 (8 kHz) → Int16Array PCM 8 kHz (sans upsample).
 * Utilisé par le détecteur d'énergie (endpointing.js) pour mesurer la fin de
 * parole acoustique de l'interlocuteur sans repasser par les 16 kHz envoyés à
 * Gemini. Lecture seule : ne change RIEN à ce que le moteur entend.
 */
export function mulawB64ToPcm8Samples(b64) {
  return decodeMulaw(Buffer.from(b64, 'base64'))
}
