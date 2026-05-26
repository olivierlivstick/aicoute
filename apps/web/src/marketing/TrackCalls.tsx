/**
 * Page admin /track_calls — dashboard des démos vitrine.
 *
 * Accès : URL secrète bookmarkée avec ?key=<DEMO_TRACK_KEY>.
 * Sans le bon key, l'Edge Function `list-demos` renvoie 401 et on affiche
 * "accès refusé" sans aucune info utile au visiteur curieux.
 *
 * Cette page n'est volontairement référencée nulle part dans la vitrine
 * (pas de lien dans le header, pas indexée par Google via robots).
 */

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

interface Row {
  id:               string
  mode:             'web' | 'phone'
  started_at:       string
  ended_at:         string | null
  duration_seconds: number | null
  phone_prefix:     string | null
  twilio_cost_eur:  number | null
  openai_cost_eur:  number | null
}

interface Totals {
  calls:      number
  twilio_eur: number
  openai_eur: number
  total_eur:  number
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; rows: Row[]; totals: Totals }
  | { kind: 'unauthorized' }
  | { kind: 'error'; message: string }

export function TrackCallsPage() {
  const [params] = useSearchParams()
  const key = params.get('key') ?? ''
  const [state, setState] = useState<State>({ kind: 'idle' })

  useEffect(() => {
    if (!key) {
      setState({ kind: 'unauthorized' })
      return
    }
    setState({ kind: 'loading' })
    ;(async () => {
      try {
        // On passe par fetch direct pour pouvoir mettre le ?key= en query
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-demos?key=${encodeURIComponent(key)}&limit=200`
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        })
        if (res.status === 401) {
          setState({ kind: 'unauthorized' })
          return
        }
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
        setState({ kind: 'ok', rows: data.rows ?? [], totals: data.totals })
      } catch (e) {
        setState({ kind: 'error', message: e instanceof Error ? e.message : 'Erreur inconnue' })
      }
    })()
  }, [key])

  return (
    <div className="min-h-screen bg-creme text-brun-900 px-6 py-10">
      <div className="max-w-container mx-auto">
        <header className="mb-8">
          <h1 className="font-serif text-3xl text-brun-900">Démos vitrine — tracking</h1>
          <p className="text-sm text-brun-700 mt-1">
            Toutes les conversations lancées depuis la home de modect.com (mode navigateur + téléphone).
          </p>
        </header>

        {state.kind === 'loading'      && <Status>Chargement…</Status>}
        {state.kind === 'unauthorized' && <Status>Accès refusé. Cette page nécessite une clé d'accès valide en URL.</Status>}
        {state.kind === 'error'        && <Status>Erreur : {state.message}</Status>}
        {state.kind === 'ok' && (
          <>
            <Summary totals={state.totals} />
            <Table rows={state.rows} />
          </>
        )}
      </div>
    </div>
  )
}

// --- UI ----------------------------------------------------------------------

function Status({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-creme-sable rounded-xl p-8 text-center text-brun-700">
      {children}
    </div>
  )
}

function Summary({ totals }: { totals: Totals }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <Card label="Nombre de démos"     value={String(totals.calls)} />
      <Card label="Coût Twilio cumulé"  value={formatEur(totals.twilio_eur)} />
      <Card label="Coût OpenAI cumulé"  value={formatEur(totals.openai_eur)} />
      <Card label="Coût total"          value={formatEur(totals.total_eur)} highlight />
    </div>
  )
}

function Card({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`bg-white border rounded-xl p-4 ${highlight ? 'border-terracotta' : 'border-creme-sable'}`}>
      <p className="text-xs uppercase tracking-widest text-brun-700">{label}</p>
      <p className={`mt-2 font-serif text-2xl ${highlight ? 'text-terracotta-dark' : 'text-brun-900'}`}>{value}</p>
    </div>
  )
}

function Table({ rows }: { rows: Row[] }) {
  const lines = useMemo(() => rows.map((r) => ({
    ...r,
    date:     formatDate(r.started_at),
    heureDeb: formatTimeShort(r.started_at),
    heureFin: r.ended_at ? formatTimeShort(r.ended_at) : '—',
    duree:    r.duration_seconds ? formatDuration(r.duration_seconds) : '—',
    twilio:   r.twilio_cost_eur != null ? formatEur(r.twilio_cost_eur) : '—',
    openai:   r.openai_cost_eur != null ? formatEur(r.openai_cost_eur) : '—',
    total:    formatEur((Number(r.twilio_cost_eur) || 0) + (Number(r.openai_cost_eur) || 0)),
  })), [rows])

  if (lines.length === 0) {
    return <Status>Aucune démo enregistrée pour le moment.</Status>
  }

  return (
    <div className="bg-white border border-creme-sable rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-creme-sable/50 text-brun-700 text-xs uppercase tracking-widest">
          <tr>
            <Th>Date</Th>
            <Th>Début</Th>
            <Th>Fin</Th>
            <Th>Durée</Th>
            <Th>Mode</Th>
            <Th>Numéro</Th>
            <Th align="right">Twilio</Th>
            <Th align="right">OpenAI</Th>
            <Th align="right">Total</Th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} className="border-t border-creme-sable/60 hover:bg-creme/40">
              <Td>{l.date}</Td>
              <Td mono>{l.heureDeb}</Td>
              <Td mono>{l.heureFin}</Td>
              <Td mono>{l.duree}</Td>
              <Td>
                <span className={`inline-block px-2 py-0.5 rounded-md text-xs ${
                  l.mode === 'web'
                    ? 'bg-accent-100 text-accent-700'
                    : 'bg-primary-100 text-primary-700'
                }`}>
                  {l.mode === 'web' ? 'Navigateur' : 'Téléphone'}
                </span>
              </Td>
              <Td mono>{l.phone_prefix ?? '—'}</Td>
              <Td align="right" mono>{l.twilio}</Td>
              <Td align="right" mono>{l.openai}</Td>
              <Td align="right" mono className="font-medium">{l.total}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <th className={`px-3 py-2.5 font-medium text-${align}`}>{children}</th>
}

function Td({ children, mono = false, align = 'left', className = '' }: {
  children: React.ReactNode
  mono?: boolean
  align?: 'left' | 'right'
  className?: string
}) {
  return (
    <td className={`px-3 py-2.5 text-${align} ${mono ? 'font-mono tabular-nums' : ''} ${className}`}>
      {children}
    </td>
  )
}

// --- Formatters --------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function formatTimeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDuration(seconds: number): string {
  const m   = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount)
}
