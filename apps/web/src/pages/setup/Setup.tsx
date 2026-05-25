import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { RefreshCw } from 'lucide-react'

export function SetupPage() {
  const { profile, user } = useAuth()
  const { updateProfile, loading: saving } = useProfile()

  const [model, setModel] = useState(profile?.agent_model ?? 'gpt-4o-realtime-preview')
  const [extraPrompt, setExtraPrompt] = useState(profile?.agent_extra_prompt ?? '')
  const [success, setSuccess] = useState(false)

  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)

  const fetchModels = async () => {
    setLoadingModels(true)
    setModelsError(null)
    try {
      const { data, error } = await supabase.functions.invoke('list-openai-models')
      if (error) throw error
      setAvailableModels(data.models ?? [])
    } catch (e) {
      setModelsError('Impossible de charger les modèles OpenAI')
    } finally {
      setLoadingModels(false)
    }
  }

  const handleSave = async () => {
    if (!user) return
    const ok = await updateProfile(user.id, {
      agent_model: model,
      agent_extra_prompt: extraPrompt.trim() || null,
    })
    if (ok) {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="font-title text-3xl font-bold text-slate-800 mb-1">Setup IA</h1>
      <p className="text-slate-500 mb-8">Configurez le modèle et les instructions globales de l'agent</p>

      <div className="space-y-6">
        {/* Modèle */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-700 mb-1">Modèle OpenAI Realtime</h2>
          <p className="text-sm text-slate-400 mb-4">
            Chargez la liste des modèles disponibles depuis votre compte OpenAI pour choisir le plus récent.
          </p>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-4o-realtime-preview"
              className="flex-1 h-10 rounded-xl border border-slate-200 bg-white px-4 font-mono text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <button
              onClick={fetchModels}
              disabled={loadingModels}
              className="flex items-center gap-2 px-4 h-10 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={loadingModels ? 'animate-spin' : ''} />
              {loadingModels ? 'Chargement…' : 'Charger les modèles'}
            </button>
          </div>

          {modelsError && (
            <p className="text-sm text-red-500 mb-2">{modelsError}</p>
          )}

          {availableModels.length > 0 && (
            <div className="space-y-1">
              <Label>Modèles disponibles — cliquez pour sélectionner</Label>
              <div className="mt-1 rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {availableModels.map((m) => (
                  <button
                    key={m}
                    onClick={() => setModel(m)}
                    className={`w-full text-left px-4 py-2.5 text-sm font-mono transition-colors ${
                      model === m
                        ? 'bg-primary-50 text-primary font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {m}
                    {model === m && <span className="ml-2 text-xs font-sans font-normal text-primary">✓ sélectionné</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-slate-400 mt-3">
            Modèle actuel enregistré : <span className="font-mono">{profile?.agent_model ?? 'gpt-4o-realtime-preview'}</span>
          </p>
        </div>

        {/* Prompt supplémentaire */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-700 mb-1">Instructions supplémentaires</h2>
          <p className="text-sm text-slate-400 mb-4">
            Ajoutées au prompt de chaque appel, avant le profil du bénéficiaire.
            Utiles pour tester des comportements ou ajuster le ton globalement.
          </p>
          <Label htmlFor="extra_prompt">Instructions (optionnel)</Label>
          <Textarea
            id="extra_prompt"
            value={extraPrompt}
            onChange={(e) => setExtraPrompt(e.target.value)}
            placeholder="Ex : Réponds toujours de manière très courte. Pose une question à la fin de chaque réponse."
            rows={6}
            className="mt-1 font-mono text-sm"
          />
          <p className="text-xs text-slate-400 mt-2">{extraPrompt.length} caractères</p>
        </div>

        {success && (
          <p className="text-sm text-green-600 bg-green-50 rounded-xl px-4 py-3">
            ✓ Configuration enregistrée — active dès le prochain appel
          </p>
        )}

        <Button onClick={handleSave} loading={saving}>
          Enregistrer
        </Button>
      </div>
    </div>
  )
}
