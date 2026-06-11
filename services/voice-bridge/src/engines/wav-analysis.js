// Analyse OFFLINE de fluidité sur l'enregistrement dual-channel (vérité terrain).
//
// C'est l'automatisation de ce qu'on mesure À L'ŒIL dans Audacity : le WAV Twilio
// est dual-channel (canal 0 + canal 1 = interlocuteur et IA, SÉPARÉS). On fait une
// VAD énergie par canal, on reconstruit les segments de parole [début, fin], puis
// on calcule les vraies latences de tour de parole — sans deviner qui parle (les
// canaux sont séparés) et sans le retard de détection du live (la fin de parole est
// REDATÉE à la dernière frame sonore, comme l'œil le ferait sur la forme d'onde).
//
// Différence clé avec le live (engines/fluidity.js + endpointing.js) : ici on a les
// 2 canaux + tout l'audio + le recul (offline) → mesure de référence. Le live est
// conservé en base mais l'UI affiche ces chiffres-ci.
//
// Best-effort : tout échec de parse → null (l'appelant garde juste recording_path).
// Tous les seuils sont surchargeables par env pour le calibrage contre Audacity.

const FRAME_MS    = Number(process.env.WAV_FRAME_MS    || 20)    // fenêtre RMS
const HANG_MS     = Number(process.env.WAV_HANG_MS     || 250)   // silence continu → fin de parole
const ONSET_MS    = Number(process.env.WAV_ONSET_MS    || 90)    // parole continue → début (rejette les clics)
const VAD_FACTOR  = Number(process.env.WAV_VAD_FACTOR  || 3.5)   // seuil = bruit de fond × facteur
const VAD_MIN_RMS = Number(process.env.WAV_VAD_MIN_RMS || 250)   // plancher absolu d'énergie (PCM16)
const AI_CHANNEL  = process.env.WAV_AI_CHANNEL                   // '0'|'1' pour forcer le canal IA

/** Parse minimal RIFF/WAVE → { fmt, dataOff, dataLen } ou null. */
function parseWav(buf) {
  if (buf.length < 44) return null
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null
  let off = 12
  let fmt = null, dataOff = -1, dataLen = 0
  while (off + 8 <= buf.length) {
    const id   = buf.toString('ascii', off, off + 4)
    const sz   = buf.readUInt32LE(off + 4)
    const body = off + 8
    if (id === 'fmt ') {
      fmt = {
        audioFormat:   buf.readUInt16LE(body),
        channels:      buf.readUInt16LE(body + 2),
        sampleRate:    buf.readUInt32LE(body + 4),
        bitsPerSample: buf.readUInt16LE(body + 14),
      }
    } else if (id === 'data') {
      dataOff = body
      dataLen = Math.min(sz, buf.length - body)
    }
    off = body + sz + (sz % 2)  // chunks alignés sur un mot
  }
  if (!fmt || dataOff < 0) return null
  return { fmt, dataOff, dataLen }
}

/** RMS par frame (énergie). */
function frameRms(samples, frameLen) {
  const n = Math.floor(samples.length / frameLen)
  const out = new Float64Array(n)
  for (let f = 0; f < n; f++) {
    let sum = 0
    const base = f * frameLen
    for (let i = 0; i < frameLen; i++) { const s = samples[base + i]; sum += s * s }
    out[f] = Math.sqrt(sum / frameLen)
  }
  return out
}

/** Bruit de fond = 20ᵉ percentile des frames non nulles. */
function noiseFloor(rms) {
  const a = []
  for (let i = 0; i < rms.length; i++) if (rms[i] > 0) a.push(rms[i])
  if (!a.length) return 0
  a.sort((x, y) => x - y)
  return a[Math.floor(a.length * 0.2)]
}

/**
 * Segments de parole à partir des RMS par frame. La fin est REDATÉE à la dernière
 * frame sonore (pas à l'instant de détection +hang) → latence fidèle à l'œil.
 * @returns {{ segs: Array<[number,number]>, threshold: number, floor: number }} ms
 */
function segmentsFromRms(rms, frameMs) {
  const floor       = noiseFloor(rms)
  const thr         = Math.max(VAD_MIN_RMS, floor * VAD_FACTOR)
  const onsetFrames = Math.max(1, Math.round(ONSET_MS / frameMs))
  const hangFrames  = Math.max(1, Math.round(HANG_MS / frameMs))
  const segs = []
  let inSpeech = false, segStart = 0, lastLoud = -1, quiet = 0, loud = 0, pendingStart = -1
  for (let f = 0; f < rms.length; f++) {
    const above = rms[f] >= thr
    if (!inSpeech) {
      if (above) {
        if (loud === 0) pendingStart = f
        loud++
        if (loud >= onsetFrames) { inSpeech = true; segStart = pendingStart; lastLoud = f; quiet = 0 }
      } else { loud = 0; pendingStart = -1 }
    } else if (above) {
      lastLoud = f; quiet = 0
    } else {
      quiet++
      if (quiet >= hangFrames) {
        segs.push([segStart * frameMs, (lastLoud + 1) * frameMs])
        inSpeech = false; loud = 0; quiet = 0; pendingStart = -1
      }
    }
  }
  if (inSpeech) segs.push([segStart * frameMs, (lastLoud + 1) * frameMs])
  return { segs, threshold: Math.round(thr), floor: Math.round(floor) }
}

function percentile(sorted, p) {
  if (!sorted.length) return null
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))
  return sorted[idx]
}

/** Stats d'un tableau de latences (ms), arrondies. samples_ms conservés pour stats ultérieures. */
function stats(arr) {
  if (!arr.length) return { avg_ms: null, p90_ms: null, max_ms: null, min_ms: null, samples: 0, samples_ms: [] }
  const s = [...arr].sort((a, b) => a - b)
  const sum = s.reduce((a, b) => a + b, 0)
  return {
    avg_ms:     Math.round(sum / s.length),
    p90_ms:     Math.round(percentile(s, 0.9)),
    max_ms:     Math.round(s[s.length - 1]),
    min_ms:     Math.round(s[0]),
    samples:    s.length,
    samples_ms: arr.map((v) => Math.round(v)),
  }
}

/**
 * Analyse un WAV dual-channel (PCM16) et renvoie les métriques de fluidité
 * « vérité terrain », ou null si le format n'est pas exploitable.
 *
 * @param {Buffer} buf  contenu WAV brut
 */
export function analyzeDualChannelWav(buf) {
  try {
    const parsed = parseWav(buf)
    if (!parsed) return null
    const { fmt, dataOff, dataLen } = parsed
    // On ne sait traiter que du PCM 16-bit ≥ 2 canaux (format Twilio .wav dual).
    if (fmt.audioFormat !== 1 || fmt.bitsPerSample !== 16 || fmt.channels < 2) {
      console.warn(`[wav-analysis] format non géré (fmt=${fmt.audioFormat} bits=${fmt.bitsPerSample} ch=${fmt.channels})`)
      return null
    }
    const ch = fmt.channels, sr = fmt.sampleRate
    const totalSamples = Math.floor(dataLen / 2 / ch)
    if (totalSamples <= 0) return null

    const ch0 = new Int16Array(totalSamples)
    const ch1 = new Int16Array(totalSamples)
    for (let i = 0; i < totalSamples; i++) {
      const base = dataOff + i * ch * 2
      ch0[i] = buf.readInt16LE(base)
      ch1[i] = buf.readInt16LE(base + 2)
    }

    const frameLen   = Math.max(1, Math.round(sr * FRAME_MS / 1000))
    const s0         = segmentsFromRms(frameRms(ch0, frameLen), FRAME_MS)
    const s1         = segmentsFromRms(frameRms(ch1, frameLen), FRAME_MS)
    const durationMs = Math.round(totalSamples / sr * 1000)

    // Canal IA : override env, sinon = le 1er à parler (bonjour proactif).
    let aiCh
    if (AI_CHANNEL === '0' || AI_CHANNEL === '1') {
      aiCh = Number(AI_CHANNEL)
    } else {
      const f0 = s0.segs[0]?.[0] ?? Infinity
      const f1 = s1.segs[0]?.[0] ?? Infinity
      aiCh = f0 <= f1 ? 0 : 1
    }
    const aiSegs   = (aiCh === 0 ? s0 : s1).segs
    const userSegs = (aiCh === 0 ? s1 : s0).segs

    // Timeline taggée triée par début.
    const tagged = [
      ...aiSegs.map(([s, e]) => ({ s, e, ai: true })),
      ...userSegs.map(([s, e]) => ({ s, e, ai: false })),
    ].sort((a, b) => a.s - b.s)

    const blanks  = []  // fin interlocuteur → début IA (LE « vrai blanc »)
    const userLat = []  // fin IA → début interlocuteur (réactivité de l'interlocuteur)
    let lastAiEnd = -1, lastUserEnd = -1
    for (const seg of tagged) {
      const lastOtherEndIsUser = lastUserEnd >= lastAiEnd
      if (seg.ai) {
        // Blanc seulement si le dernier à avoir parlé était l'interlocuteur (vrai relais).
        if (lastUserEnd >= 0 && lastOtherEndIsUser && seg.s >= lastUserEnd) blanks.push(seg.s - lastUserEnd)
        lastAiEnd = Math.max(lastAiEnd, seg.e)
      } else {
        if (lastAiEnd >= 0 && !lastOtherEndIsUser && seg.s >= lastAiEnd) userLat.push(seg.s - lastAiEnd)
        lastUserEnd = Math.max(lastUserEnd, seg.e)
      }
    }

    // Barge-in : l'interlocuteur commence À PENDANT que l'IA parle.
    const overlaps = []
    let bargeIn = 0
    for (const [us, ue] of userSegs) {
      for (const [as, ae] of aiSegs) {
        if (us > as && us < ae) {  // début user strictement dans un segment IA
          bargeIn++
          overlaps.push(Math.min(ae, ue) - us)
          break
        }
      }
    }

    const aiSpeechMs   = aiSegs.reduce((a, [s, e]) => a + (e - s), 0)
    const userSpeechMs = userSegs.reduce((a, [s, e]) => a + (e - s), 0)

    return {
      source:           'wav',
      sample_rate:      sr,
      channels:         ch,
      ai_channel:       aiCh,
      duration_ms:      durationMs,
      duration_seconds: Math.round(durationMs / 1000),
      blank: {
        start_ms: aiSegs[0]?.[0] ?? null,  // décroché → 1er son IA (bonjour)
        ...renameTurn(stats(blanks)),
      },
      barge_in: {
        total:          bargeIn,
        per_min:        +(bargeIn / Math.max(1, durationMs / 60000)).toFixed(2),
        overlap_avg_ms: overlaps.length ? Math.round(overlaps.reduce((a, b) => a + b, 0) / overlaps.length) : null,
        overlap_max_ms: overlaps.length ? Math.round(Math.max(...overlaps)) : null,
        overlap_ms:     overlaps.map((v) => Math.round(v)),
      },
      user_latency: stats(userLat),  // fin IA → début interlocuteur
      turns: { assistant: aiSegs.length, user: userSegs.length },
      assistant_speech_ms: aiSpeechMs,
      user_speech_ms:      userSpeechMs,
      speech_ratio:        durationMs ? +(aiSpeechMs / durationMs).toFixed(4) : null,
      // Données BRUTES pour analyses statistiques ultérieures (≈ ce qu'on lit dans Audacity).
      segments: { ai: aiSegs, user: userSegs },
      vad: {
        frame_ms: FRAME_MS, hang_ms: HANG_MS, onset_ms: ONSET_MS,
        factor: VAD_FACTOR, min_rms: VAD_MIN_RMS,
        threshold_ai:   aiCh === 0 ? s0.threshold : s1.threshold,
        threshold_user: aiCh === 0 ? s1.threshold : s0.threshold,
      },
    }
  } catch (err) {
    console.error('[wav-analysis]', err?.message || err)
    return null
  }
}

// stats() renvoie avg_ms/p90_ms/... ; pour le « blanc » on veut le préfixe turn_*
// afin de réutiliser le même schéma que le live (FluidityMetrics.blank).
function renameTurn(st) {
  return {
    turn_avg_ms: st.avg_ms,
    turn_p90_ms: st.p90_ms,
    turn_max_ms: st.max_ms,
    turn_min_ms: st.min_ms,
    samples:     st.samples,
    samples_ms:  st.samples_ms,
  }
}
