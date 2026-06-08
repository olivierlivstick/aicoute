import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { createBeneficiary } from '@/hooks/useBeneficiary'
import { useSelectedBeneficiary } from '@/hooks/useSelectedBeneficiary'
import { supabase } from '@/lib/supabase'
import { resolvePromptPlaceholders } from '@modect/shared'
import { Step1BasicInfo } from './steps/Step1BasicInfo'
import { Step2History } from './steps/Step2History'
import { Step3Tastes } from './steps/Step3Tastes'
import { Step4Personality } from './steps/Step4Personality'
import { Step5AIConfig } from './steps/Step5AIConfig'
import type { Beneficiary } from '@modect/shared'
import { cn } from '@/lib/utils'

// preferred_engine n'est pas (encore) dans le type Beneficiary partagé (cf.
// CLAUDE.md : types Database incomplets, accès par cast) → on l'ajoute ici.
export type WizardData = Partial<Omit<Beneficiary, 'id' | 'created_at' | 'updated_at' | 'caregiver_id'>>
  & { preferred_engine?: 'openai' | 'gemini' }

const STEPS = [
  { label: 'Infos de base',    short: '1' },
  { label: 'Son histoire',     short: '2' },
  { label: 'Ses goûts',        short: '3' },
  { label: 'Personnalité',     short: '4' },
  { label: 'Configuration IA', short: '5' },
]

export function BeneficiaryWizard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { refetch, selectBeneficiary } = useSelectedBeneficiary()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<WizardData>({
    language_preference: 'fr',
    report_language: 'fr',
    preferred_engine: 'openai',
    ai_voice: 'cedar',
    gemini_voice: 'Aoede',
    ai_persona_name: 'Marie',
    conversation_style: 'warm',
    is_active: true,
    onboarding_completed: false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (patch: WizardData) => setData((prev) => ({ ...prev, ...patch }))

  const next = (patch?: WizardData) => {
    if (patch) update(patch)
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const prev = () => setStep((s) => Math.max(s - 1, 0))

  const submit = async (patch?: WizardData) => {
    if (!user) return
    const final = { ...data, ...(patch ?? {}) }
    setSaving(true)
    setError(null)

    // Snapshot du prompt par défaut → copie CONCRÈTE (variables résolues) pour ce
    // bénéficiaire : le prompt principal (sortant) ET l'ouverture des appels
    // entrants. Si la lecture échoue, on laisse NULL → fallback sur le défaut au
    // moment de l'appel.
    let customPrompt: string | null = null
    let inboundCustomPrompt: string | null = null
    const { data: tpl } = await supabase
      .from('prompt_templates')
      .select('template, inbound_opening')
      .eq('id', 1)
      .maybeSingle()
    const tplRow = tpl as { template: string; inbound_opening: string | null } | null
    const resolveInput = {
      first_name:          final.first_name ?? '',
      ai_persona_name:     final.ai_persona_name ?? 'Marie',
      conversation_style:  final.conversation_style ?? 'warm',
      language_preference: final.language_preference ?? 'fr',
      gender:              final.gender ?? null,
    }
    if (tplRow?.template) {
      customPrompt = resolvePromptPlaceholders(tplRow.template, resolveInput)
    }
    if (tplRow?.inbound_opening) {
      inboundCustomPrompt = resolvePromptPlaceholders(tplRow.inbound_opening, resolveInput)
    }

    const result = await createBeneficiary({
      caregiver_id: user.id,
      first_name: final.first_name ?? '',
      last_name: final.last_name ?? '',
      birth_year: final.birth_year ?? null,
      gender: final.gender ?? null,
      phone: final.phone ?? null,
      push_token: null,
      family_history: final.family_history ?? null,
      life_story: final.life_story ?? null,
      hobbies: final.hobbies ?? null,
      favorite_topics: final.favorite_topics ?? null,
      topics_to_avoid: final.topics_to_avoid ?? null,
      personality_notes: final.personality_notes ?? null,
      health_notes: final.health_notes ?? null,
      language_preference: final.language_preference ?? 'fr',
      report_language: final.report_language ?? 'fr',
      ai_voice: final.ai_voice ?? 'cedar',
      gemini_voice: final.gemini_voice ?? 'Aoede',
      ai_persona_name: final.ai_persona_name ?? 'Marie',
      conversation_style: final.conversation_style ?? 'warm',
      custom_prompt: customPrompt,
      inbound_custom_prompt: inboundCustomPrompt,
      is_active: true,
      onboarding_completed: true,
      // preferred_engine absent du type Beneficiary partagé → cast (cf. WizardData)
      ...(final.preferred_engine ? { preferred_engine: final.preferred_engine } : {}),
    } as unknown as Parameters<typeof createBeneficiary>[0])

    setSaving(false)
    if (!result) {
      setError('Une erreur est survenue. Veuillez réessayer.')
      return
    }
    // Recharger la liste du contexte et sélectionner le nouveau bénéficiaire
    await refetch()
    selectBeneficiary(result.id)
    // Étape suivante de l'onboarding : choix du forfait + planning des appels.
    navigate('/planning?created=1', { replace: true })
  }

  const stepProps = { data, onNext: next, onPrev: prev, onSubmit: submit, saving }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Titre */}
      <div className="mb-8">
        <h1 className="font-title text-3xl font-bold text-slate-800">Ajouter un bénéficiaire</h1>
        <p className="text-slate-500 mt-1">Remplissez le profil pour personnaliser les conversations IA</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center mb-10">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className="flex flex-col items-center gap-1 group"
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                  i < step  && 'bg-primary text-white cursor-pointer',
                  i === step && 'bg-primary text-white ring-4 ring-primary/20',
                  i > step  && 'bg-slate-100 text-slate-400'
                )}
              >
                {i < step ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3.5 3.5L13 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  s.short
                )}
              </div>
              <span className={cn(
                'text-xs hidden sm:block',
                i === step ? 'text-primary font-semibold' : 'text-slate-400'
              )}>
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={cn('flex-1 h-0.5 mx-2 mb-5', i < step ? 'bg-primary' : 'bg-slate-200')} />
            )}
          </div>
        ))}
      </div>

      {/* Contenu de l'étape */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
        )}
        {step === 0 && <Step1BasicInfo {...stepProps} />}
        {step === 1 && <Step2History {...stepProps} />}
        {step === 2 && <Step3Tastes {...stepProps} />}
        {step === 3 && <Step4Personality {...stepProps} />}
        {step === 4 && <Step5AIConfig {...stepProps} />}
      </div>
    </div>
  )
}
