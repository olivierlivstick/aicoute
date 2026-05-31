import { useEffect, useState } from 'react'
import { Check, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'

/**
 * Édition du prompt système PAR DÉFAUT de la plateforme (table singleton
 * prompt_templates, id=1). Contient la personnalité + les règles, avec des
 * variables résolues au moment de l'appel. Le contexte (infos bénéficiaire,
 * mémoire, dernier appel, sujets, durée) est ajouté automatiquement par le code.
 *
 * Ce défaut est dupliqué (variables résolues) dans chaque nouveau bénéficiaire.
 * Modifier le défaut N'AFFECTE PAS les bénéficiaires déjà créés.
 */

const PLACEHOLDERS: Array<{ token: string; desc: string }> = [
  { token: '{{persona}}', desc: 'le prénom du compagnon IA (ex : Léa)' },
  { token: '{{prenom}}',  desc: 'le prénom du bénéficiaire' },
  { token: '{{langue}}',  desc: 'la langue (ex : français)' },
  { token: '{{style}}',   desc: 'le ton choisi (ex : chaleureux, bienveillant…)' },
  { token: '{{il_elle}}', desc: 'le pronom selon le genre (il / elle)' },
]

export function AdminPromptPage() {
  const [template, setTemplate]   = useState('')
  const [original, setOriginal]   = useState('')
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase
        .from('prompt_templates')
        .select('template')
        .eq('id', 1)
        .maybeSingle()
      if (err) setError(err.message)
      else {
        const t = (data as { template: string } | null)?.template ?? ''
        setTemplate(t)
        setOriginal(t)
      }
      setLoading(false)
    })()
  }, [])

  async function save() {
    setSaving(true)
    setError(null)
    const { data: userRes } = await supabase.auth.getUser()
    const { error: err } = await supabase
      .from('prompt_templates')
      .update({
        template,
        updated_at: new Date().toISOString(),
        updated_by: userRes.user?.id ?? null,
      })
      .eq('id', 1)
    setSaving(false)
    if (err) { setError(err.message); return }
    setOriginal(template)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const dirty = template !== original

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-accent-700 font-semibold mb-1">Administration</p>
        <h1 className="font-serif text-3xl font-semibold text-brun-900">Prompt système (défaut)</h1>
        <p className="text-slate-500 mt-1">
          Personnalité et règles de comportement du compagnon, communes à toute la plateforme.
        </p>
      </header>

      {loading ? (
        <p className="text-slate-400 text-sm">Chargement…</p>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-start gap-2 bg-accent-50 text-accent-800 rounded-xl px-4 py-3 mb-5 text-sm">
            <Info size={16} className="mt-0.5 shrink-0" />
            <div>
              <p>Le <strong>contexte</strong> (infos du bénéficiaire, mémoire, dernière conversation, sujets, durée) est ajouté <strong>automatiquement</strong> après ce texte — inutile de l'écrire ici.</p>
              <p className="mt-1">Modifier ce défaut n'affecte <strong>pas</strong> les bénéficiaires déjà créés (chacun a sa propre copie, éditable dans sa fiche).</p>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Variables disponibles</p>
            <div className="flex flex-wrap gap-2">
              {PLACEHOLDERS.map(({ token, desc }) => (
                <span key={token} className="inline-flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1">
                  <code className="text-primary font-semibold">{token}</code>
                  <span className="text-slate-500">{desc}</span>
                </span>
              ))}
            </div>
          </div>

          <Textarea
            rows={22}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="font-mono text-sm leading-relaxed"
          />

          <div className="flex items-center justify-between pt-5 mt-4 border-t border-slate-100">
            <div className="flex-1">
              {saved && (
                <p className="text-sm text-sauge bg-sauge/10 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5">
                  <Check size={14} />
                  Prompt par défaut enregistré
                </p>
              )}
              {error && (
                <p className="text-sm text-brique bg-brique/10 rounded-lg px-3 py-1.5">{error}</p>
              )}
            </div>
            <Button onClick={save} loading={saving} disabled={!dirty || !template.trim()}>
              Enregistrer
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
