// AudioWorkletProcessor : capture micro à sampleRate natif (typiquement 48 kHz),
// downsample à 16 kHz, convertit en PCM16 LE, envoie en chunks ~20 ms au main
// thread qui les forward au voice-bridge en base64.
//
// Servi statiquement depuis /public (Vite) → chargé via
// audioContext.audioWorklet.addModule('/gemini-audio-worklet.js'). Doit rester
// du JS natif (pas TS) car le navigateur charge ce module tel quel.

const TARGET_SAMPLE_RATE = 16000
const CHUNK_SAMPLES      = 320  // 20 ms à 16 kHz = un message WS toutes les 20 ms

class Pcm16Downsampler extends AudioWorkletProcessor {
  constructor() {
    super()
    // sampleRate est une globale du worklet (sample rate du AudioContext parent).
    // À 48 kHz → ratio = 3.0 ; à 44.1 kHz → ratio = 2.756.
    this.ratio     = sampleRate / TARGET_SAMPLE_RATE
    this.outBuffer = new Int16Array(CHUNK_SAMPLES)
    this.outIndex  = 0
    // Accumulateur fractionnaire pour downsample sans drift cumulatif :
    // on émet un sample chaque fois que acc franchit ratio.
    this.acc       = 0
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true
    const channel = input[0]
    if (!channel) return true

    for (let i = 0; i < channel.length; i++) {
      this.acc += 1
      if (this.acc >= this.ratio) {
        this.acc -= this.ratio

        let s = channel[i]
        if (s >  1) s =  1
        if (s < -1) s = -1
        // Float32 [-1, 1] → Int16 [-32768, 32767]. On utilise 0x8000 pour les
        // valeurs négatives et 0x7FFF pour les positives pour avoir une plage
        // symétrique sans saturation.
        this.outBuffer[this.outIndex++] = s < 0
          ? Math.round(s * 0x8000)
          : Math.round(s * 0x7FFF)

        if (this.outIndex >= CHUNK_SAMPLES) {
          // Copie le buffer pour ne pas qu'il soit écrasé par les samples
          // suivants, puis transfère le ArrayBuffer au main thread (zéro-copie).
          const copy = new Int16Array(this.outBuffer)
          this.port.postMessage(copy.buffer, [copy.buffer])
          this.outIndex = 0
        }
      }
    }

    return true
  }
}

registerProcessor('pcm16-downsampler', Pcm16Downsampler)
