/**
 * Modal « Qualité » — affiche le snapshot technique de fluidité d'un appel
 * (Étape 0 = observation). Partagé entre les onglets de /admin/appels : appels
 * (table `calls`) et Démos vitrine (table `demo_calls`). Les données sont
 * produites par le voice-bridge (services/voice-bridge/src/engines/fluidity.js).
 *
 * Pure lecture : aucune action, on regarde les chiffres pour décider plus tard.
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
    samples?:     number
    samples_ms?:  number[]
    approx?:      boolean
  }
  barge_in?:             { total?: number; per_min?: number; suspected_false?: number | null }
  presence_checks?:      { count?: number; matches?: string[] } | null
  assistant_speech_ms?:  number
  speech_ratio?:         number
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

export function FluidityModal({ metrics, onClose, subtitle }: {
  metrics:  FluidityMetrics
  onClose:  () => void
  subtitle?: string
}) {
  const blank    = metrics.blank ?? {}
  const barge    = metrics.barge_in ?? {}
  const presence = metrics.presence_checks
  const engine   = metrics.engine === 'gemini' ? 'Gemini' : metrics.engine === 'openai' ? 'OpenAI' : '—'

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
              {subtitle ? `${subtitle} · ` : ''}Moteur {engine} · durée {fmtSec(metrics.duration_seconds)}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-brun-700 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Le blanc */}
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

          {/* Interruptions */}
          <Section title="Interruptions (barge-in)">
            <Row label="Total"             value={barge.total != null ? String(barge.total) : '—'} />
            <Row label="Par minute"        value={barge.per_min != null ? barge.per_min.toFixed(2) : '—'} />
            <Row
              label="Faux barge-in suspectés (bruit ?)"
              value={barge.suspected_false != null ? String(barge.suspected_false) : 'non mesuré'}
              muted={barge.suspected_false == null}
            />
          </Section>

          {/* Présence */}
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

          {/* Contexte */}
          <Section title="Contexte">
            <Row label="Tours de parole (IA / utilisateur)"
                 value={`${metrics.turns?.assistant ?? '—'} / ${metrics.turns?.user ?? '—'}`} />
            <Row label="Temps de parole de l'IA"
                 value={fmtMs(metrics.assistant_speech_ms)} />
            <Row label="Ratio parole IA / durée"
                 value={metrics.speech_ratio != null ? `${Math.round(metrics.speech_ratio * 100)} %` : '—'} />
          </Section>
        </div>
      </div>
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
