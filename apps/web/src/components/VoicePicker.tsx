import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Loader2 } from 'lucide-react'
import { voicesForEngine } from '@modect/shared'
import { cn } from '@/lib/utils'

interface Props {
  /** Moteur sélectionné — détermine le catalogue de voix proposé. */
  engine: 'openai' | 'gemini'
  /** Identifiant de la voix retenue (cedar, Aoede, …). */
  value: string
  onChange: (voiceId: string) => void
}

/**
 * Sélecteur de voix avec écoute d'un échantillon par voix. Les voix dépendent
 * du moteur → ce composant doit être affiché APRÈS le choix du moteur.
 * Échantillons = fichiers statiques sous /voice-samples (cf. make-voice-samples.mjs).
 */
export function VoicePicker({ engine, value, onChange }: Props) {
  const voices = voicesForEngine(engine)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // null = rien ne joue ; 'loading:<id>' = chargement ; sinon = id en lecture
  const [playing, setPlaying] = useState<string | null>(null)

  // Stoppe toute lecture quand on change de moteur (ou au démontage).
  useEffect(() => {
    return () => { audioRef.current?.pause() }
  }, [])
  useEffect(() => {
    audioRef.current?.pause()
    setPlaying(null)
  }, [engine])

  const togglePlay = (id: string, src: string) => {
    let audio = audioRef.current
    if (!audio) {
      audio = new Audio()
      audio.onended = () => setPlaying(null)
      audioRef.current = audio
    }
    if (playing === id) {
      audio.pause()
      setPlaying(null)
      return
    }
    audio.pause()
    audio.src = src
    audio.currentTime = 0
    setPlaying(`loading:${id}`)
    void audio.play()
      .then(() => setPlaying(id))
      .catch(() => setPlaying(null))
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-1">
      {voices.map(({ id, label, gender, description, sample }) => {
        const selected = value === id
        const isPlaying = playing === id
        const isLoading = playing === `loading:${id}`
        return (
          <div
            key={id}
            title={description}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2 text-center transition-all',
              selected
                ? 'border-primary bg-primary-50'
                : 'border-slate-200 hover:border-slate-300'
            )}
          >
            <button
              type="button"
              onClick={() => onChange(id)}
              className="w-full min-w-0"
            >
              <span
                className={cn(
                  'block font-semibold text-sm truncate',
                  selected ? 'text-primary' : 'text-slate-700'
                )}
              >
                {label}
              </span>
              <span
                className={cn(
                  'block text-[10px] font-medium uppercase tracking-wide',
                  gender === 'female' ? 'text-accent-700' : 'text-slate-400'
                )}
              >
                {gender === 'female' ? 'Féminine' : 'Masculine'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => togglePlay(id, sample)}
              aria-label={isPlaying ? `Arrêter l'écoute de ${label}` : `Écouter ${label}`}
              className={cn(
                'shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                isPlaying
                  ? 'bg-primary text-white'
                  : 'bg-white border border-slate-200 text-primary hover:bg-primary-50'
              )}
            >
              {isLoading
                ? <Loader2 size={15} className="animate-spin" />
                : isPlaying
                  ? <Pause size={15} />
                  : <Play size={15} className="ml-0.5" />}
            </button>
          </div>
        )
      })}
    </div>
  )
}
