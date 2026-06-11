/**
 * Modal « Qualité » — fluidité d'un appel. Deux sources possibles :
 *
 *  1. `analysis` (recording_analysis) = VÉRITÉ TERRAIN, calculée OFFLINE par le
 *     voice-bridge sur l'enregistrement WAV dual-channel (VAD énergie par canal →
 *     vraies latences de tour de parole). C'est l'automatisation de la mesure à
 *     l'œil dans Audacity → c'est ELLE qu'on affiche dès qu'elle existe.
 *  2. `metrics` (fluidity_metrics) = mesure LIVE historique (un seul canal, seuils
 *     approximatifs). Conservée en base, affichée seulement en repli (appels sans
 *     enregistrement, ou antérieurs à l'analyse WAV).
 *
 * Pure lecture : aucune action.
 */

export interface FluidityMetrics {
  engine?:               string
  duration_seconds?:     number
  turns?:                { assistant?: number | null; user?: number | null }
  blank?: {
    start_ms?:    number | null
    turn_avg_ms?: number | null
    turn_p90_ms?: number | null
    turn_max_ms?: number | null
    turn_min_ms?: number | null
    samples?:     number
    samples_ms?:  number[]
    approx?:      boolean
  }
  barge_in?:             { total?: number; per_min?: number; suspected_false?: number | null }
  presence_checks?:      { count?: number; matches?: string[] } | null
  assistant_speech_ms?:  number
  speech_ratio?:         number
}

/** Analyse « vérité terrain » sur le WAV (engines/wav-analysis.js). */
export interface RecordingAnalysis {
  source:             'wav'
  duration_seconds?:  number
  ai_channel?:        number
  blank?: {
    start_ms?:    number | null
    turn_avg_ms?: number | null
    turn_p90_ms?: number | null
    turn_max_ms?: number | null
    turn_min_ms?: number | null
    samples?:     number
    samples_ms?:  number[]
  }
  barge_in?:           { total?: number; per_min?: number; overlap_avg_ms?: number | null; overlap_max_ms?: number | null }
  user_latency?:       { avg_ms?: number | null; p90_ms?: number | null; max_ms?: number | null; min_ms?: number | null; samples?: number }
  turns?:              { assistant?: number | null; user?: number | null }
  assistant_speech_ms?: number
  user_speech_ms?:      number
  speech_ratio?:        number
  vad?:                 { threshold_ai?: number; threshold_user?: number; factor?: number; hang_ms?: number }
}

function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

function fmtSec(s: number | null | undefined): string {
  if (s == null) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return m > 0 ? `${m}m${sec.toString().padStart(2, '0')}` : `${sec}s`
}

export function FluidityModal({ metrics, analysis, engine, durationSeconds, onClose, subtitle }: {
  metrics?:         FluidityMetrics | null
  analysis?:        RecordingAnalysis | null
  engine?:          string | null
  durationSeconds?: number | null
  onClose:          () => void
  subtitle?:        string
}) {
  const wav      = !!analysis
  const eng      = engine ?? metrics?.engine
  const engLabel = eng === 'gemini' ? 'Gemini' : eng === 'openai' ? 'OpenAI' : '—'
  const dur      = durationSeconds ?? analysis?.duration_seconds ?? metrics?.duration_seconds

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brun-900/40 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-creme-sable shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-creme-sable">
          <div>
            <h2 className="font-serif text-2xl text-brun-900">Qualité de la conversation</h2>
            <p className="text-xs text-slate-500 mt-1">
              {subtitle ? `${subtitle} · ` : ''}Moteur {engLabel} · durée {fmtSec(dur)}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-brun-700 text-xl leading-none">×</button>
        </div>

        {wav
          ? <WavView a={analysis!} />
          : <LiveView metrics={metrics ?? {}} />}
      </div>
    </div>
  )
}

/** Vue VÉRITÉ TERRAIN — chiffres mesurés sur l'enregistrement WAV. */
function WavView({ a }: { a: RecordingAnalysis }) {
  const blank = a.blank ?? {}
  const barge = a.barge_in ?? {}
  const ul    = a.user_latency ?? {}
  const vad   = a.vad ?? {}
  return (
    <div className="px-6 py-5 space-y-5">
      <p className="text-[11px] text-sauge bg-sauge/10 rounded-md px-2 py-1.5 flex items-center gap-1.5">
        🎧 <span><strong>Vérité terrain</strong> — mesuré sur l'enregistrement (2 canaux séparés), comme à l'œil dans Audacity.</span>
      </p>

      <Section title="Le « blanc » — latence de prise de parole de l'IA">
        <Row label="Au démarrage (décroché → 1er mot)" value={fmtMs(blank.start_ms)} />
        <Row label="En conversation — moyenne"          value={fmtMs(blank.turn_avg_ms)} />
        <Row label="En conversation — p90"              value={fmtMs(blank.turn_p90_ms)} />
        <Row label="En conversation — max"              value={fmtMs(blank.turn_max_ms)} />
        <Row label="En conversation — min"              value={fmtMs(blank.turn_min_ms)} />
        <Row label="Nombre de mesures"                  value={blank.samples != null ? String(blank.samples) : '—'} />
      </Section>

      <Section title="Réactivité de l'interlocuteur (fin IA → reprise)">
        <Row label="Moyenne" value={fmtMs(ul.avg_ms)} />
        <Row label="p90"     value={fmtMs(ul.p90_ms)} />
        <Row label="max"     value={fmtMs(ul.max_ms)} />
      </Section>

      <Section title="Interruptions (barge-in)">
        <Row label="Total (interlocuteur coupe l'IA)" value={barge.total != null ? String(barge.total) : '—'} />
        <Row label="Par minute"                       value={barge.per_min != null ? barge.per_min.toFixed(2) : '—'} />
        <Row label="Chevauchement moyen"              value={fmtMs(barge.overlap_avg_ms)} />
        <Row label="Chevauchement max"                value={fmtMs(barge.overlap_max_ms)} />
      </Section>

      <Section title="Contexte">
        <Row label="Tours de parole (IA / interlocuteur)"
             value={`${a.turns?.assistant ?? '—'} / ${a.turns?.user ?? '—'}`} />
        <Row label="Temps de parole de l'IA"          value={fmtMs(a.assistant_speech_ms)} />
        <Row label="Temps de parole de l'interlocuteur" value={fmtMs(a.user_speech_ms)} />
        <Row label="Ratio parole IA / durée"
             value={a.speech_ratio != null ? `${Math.round(a.speech_ratio * 100)} %` : '—'} />
      </Section>

      <p className="text-[11px] text-slate-400 pt-1 border-t border-creme-sable">
        Canal IA détecté : #{a.ai_channel ?? '—'} · seuils VAD IA/interloc.{' '}
        {vad.threshold_ai ?? '—'}/{vad.threshold_user ?? '—'} (×{vad.factor ?? '—'}, hang {vad.hang_ms ?? '—'} ms).
        Surchargeables par env <code>WAV_*</code> pour calibrer.
      </p>
    </div>
  )
}

/** Vue LIVE — mesure historique (repli quand pas d'enregistrement). */
function LiveView({ metrics }: { metrics: FluidityMetrics }) {
  const blank    = metrics.blank ?? {}
  const barge    = metrics.barge_in ?? {}
  const presence = metrics.presence_checks
  return (
    <div className="px-6 py-5 space-y-5">
      <p className="text-[11px] text-slate-500 bg-creme rounded-md px-2 py-1.5">
        Mesure <strong>live</strong> (un seul canal, approximative) — pas d'enregistrement pour cet appel.
      </p>

      <Section title="Le « blanc » — latence de prise de parole de l'IA">
        <Row label="Au démarrage (décroché → 1er mot)" value={fmtMs(blank.start_ms)} />
        <Row label="En conversation — moyenne"          value={fmtMs(blank.turn_avg_ms)} />
        <Row label="En conversation — p90"              value={fmtMs(blank.turn_p90_ms)} />
        <Row label="En conversation — max"              value={fmtMs(blank.turn_max_ms)} />
        <Row label="Nombre de mesures"                  value={blank.samples != null ? String(blank.samples) : '—'} />
        {blank.approx && (
          <p className="text-[11px] text-accent-700 bg-accent-50 rounded-md px-2 py-1.5 mt-1">
            ⚠ Valeurs <strong>approximatives</strong> : Gemini ne fournit pas d'event de fin de
            parole, la latence est estimée via le transcript.
          </p>
        )}
      </Section>

      <Section title="Interruptions (barge-in)">
        <Row label="Total"             value={barge.total != null ? String(barge.total) : '—'} />
        <Row label="Par minute"        value={barge.per_min != null ? barge.per_min.toFixed(2) : '—'} />
        <Row
          label="Faux barge-in suspectés (bruit ?)"
          value={barge.suspected_false != null ? String(barge.suspected_false) : 'non mesuré'}
          muted={barge.suspected_false == null}
        />
      </Section>

      <Section title="Signaux de présence (« allô ? »)">
        {presence == null ? (
          <p className="text-sm text-slate-400">Non mesuré (pas de transcript pour cet appel).</p>
        ) : (
          <>
            <Row label="Occurrences" value={String(presence.count ?? 0)} />
            {!!presence.matches?.length && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {presence.matches.map((m, i) => (
                  <span key={i} className="inline-block bg-creme text-brun-700 rounded-md px-2 py-0.5 text-xs">
                    « {m} »
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </Section>

      <Section title="Contexte">
        <Row label="Tours de parole (IA / utilisateur)"
             value={`${metrics.turns?.assistant ?? '—'} / ${metrics.turns?.user ?? '—'}`} />
        <Row label="Temps de parole de l'IA"
             value={fmtMs(metrics.assistant_speech_ms)} />
        <Row label="Ratio parole IA / durée"
             value={metrics.speech_ratio != null ? `${Math.round(metrics.speech_ratio * 100)} %` : '—'} />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  )
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-brun-700">{label}</span>
      <span className={`font-mono tabular-nums ${muted ? 'text-slate-400' : 'text-brun-900'}`}>{value}</span>
    </div>
  )
}
