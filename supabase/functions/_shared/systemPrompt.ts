/**
 * Constructeur du system prompt pour l'agent IA MODECT.
 *
 * Le prompt final = [TEMPLATE éditable, interpolé] + [BLOC CONTEXTE assemblé ici].
 *   - TEMPLATE   : personnalité + règles. Éditable (défaut admin en DB `prompt_templates`,
 *                  ou copie concrète par bénéficiaire `beneficiaries.custom_prompt`).
 *                  Variables : {{persona}} {{prenom}} {{langue}} {{style}} {{il_elle}}.
 *   - BLOC CONTEXTE : infos bénéficiaire + dernière conversation + mémoire + sujets +
 *                  durée cible. Toujours assemblé par le code (jamais éditable).
 *
 * Cascade de fallback : custom_prompt (concret) → defaultTemplate (DB) → CODE_DEFAULT (ci-dessous).
 */

interface BeneficiaryContext {
  first_name: string
  birth_year: number | null
  gender: string | null
  family_history: string | null
  life_story: string | null
  hobbies: string | null
  favorite_topics: string | null
  topics_to_avoid: string | null
  personality_notes: string | null
  health_notes: string | null
  language_preference: string
  ai_persona_name: string
  conversation_style: string
}

interface MemoryItem {
  memory_type: string
  content: string
  importance: number
}

interface ScheduleContext {
  max_duration_minutes: number
  suggested_topics: string[] | null
  special_instructions: string | null
}

interface PreviousCallContext {
  ended_at: string | null            // ISO ; fallback sur started_at en amont
  summary: string
  key_topics: string[] | null
  memorable_moments: string[] | null
}

const STYLE_DESCRIPTIONS: Record<string, string> = {
  warm:    'chaleureux, bienveillant et affectueux',
  playful: 'enjoué, léger et plein d\'humour doux',
  calm:    'calme, posé et rassurant',
  formal:  'respectueux et traditionnel, en vouvoyant',
}

const GENDER_PRONOUN: Record<string, { subject: string; object: string; adj: string }> = {
  female: { subject: 'elle', object: 'la', adj: 'née' },
  male:   { subject: 'il',   object: 'le', adj: 'né' },
  other:  { subject: 'il/elle', object: 'le/la', adj: 'né(e)' },
}

const FR_MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

/**
 * Template par défaut codé en dur — FILET DE SÉCURITÉ si la table `prompt_templates`
 * est vide/inaccessible. La source de vérité est la DB (seedée par la migration
 * 20260531000002). GARDER CES DEUX TEXTES EN PHASE.
 */
export const CODE_DEFAULT_TEMPLATE = `Tu es {{persona}}, un compagnon bienveillant et chaleureux qui appelle {{prenom}} pour bavarder.
Tu parles en {{langue}}, avec un ton {{style}}.
Tu t'adresses à {{prenom}} directement, de façon personnelle et chaleureuse.

═══════════════════════════════════════
TES INSTRUCTIONS
═══════════════════════════════════════
1. Commence par un bonjour chaleureux et personnel, par exemple : "Bonjour {{prenom}} ! C'est {{persona}}." puis demande naturellement comment {{il_elle}} va. Si tu te souviens d'une conversation précédente (voir le contexte plus bas), fais-y un clin d'œil spontané — par exemple en prenant des nouvelles d'un sujet évoqué la dernière fois. Reste naturel, ne récite jamais le résumé.
2. Pose des questions ouvertes, laisse {{prenom}} parler, ne coupe jamais la parole.
3. Évoque naturellement les souvenirs et le fil de la dernière conversation (voir le contexte plus bas) quand c'est pertinent, sans te répéter.
4. Conclus naturellement et en douceur quand le temps de l'appel approche de sa fin (voir la durée cible dans le contexte).
5. En cas de détresse manifeste (tristesse profonde, problème de santé urgent), rassure chaleureusement et suggère gentiment d'appeler un proche ou le 15.
6. Tu es UN COMPAGNON DE CONVERSATION, pas un assistant généraliste. Ne réponds pas à des demandes techniques, de recherche ou hors-sujet.
7. NE MENTIONNE JAMAIS que tu es une IA, sauf si {{prenom}} le demande EXPLICITEMENT et directement.
8. Si {{prenom}} demande si tu es une IA, tu peux répondre honnêtement et simplement, sans t'étendre.
9. Utilise le prénom "{{prenom}}" régulièrement pour personnaliser la conversation.
10. Chaque appel doit laisser {{prenom}} avec le sourire ou un sentiment de réconfort.`

/**
 * Date relative en français pour le rappel du dernier appel :
 * "aujourd'hui" / "hier" / "il y a N jours" (< 7 j) / "le 29 mai".
 * Comparaison par jour calendaire (un appel à 23h "hier" reste "hier").
 * NB : les Edge Functions tournent en UTC — imprécision possible d'une heure
 * autour de minuit, acceptable pour un label flou.
 */
export function frenchRelativeDate(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'récemment'
  const then = new Date(iso)
  if (isNaN(then.getTime())) return 'récemment'
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfThen  = new Date(then.getFullYear(), then.getMonth(), then.getDate())
  const days = Math.round((startOfToday.getTime() - startOfThen.getTime()) / 86_400_000)

  if (days <= 0)  return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 7)   return `il y a ${days} jours`
  return `le ${then.getDate()} ${FR_MONTHS[then.getMonth()]}`
}

/**
 * Remplace les variables du template par les valeurs concrètes du bénéficiaire.
 * Les variables inconnues sont laissées telles quelles (pas de crash).
 * (Côté web, packages/shared/promptTemplate.ts a une copie pour le snapshot wizard.)
 */
export function resolvePromptPlaceholders(template: string, b: BeneficiaryContext): string {
  const styleDesc = STYLE_DESCRIPTIONS[b.conversation_style] ?? 'chaleureux et bienveillant'
  const langLabel = b.language_preference === 'fr' ? 'français' : b.language_preference
  const pronoun   = GENDER_PRONOUN[b.gender ?? 'other']
  return template
    .replaceAll('{{persona}}', b.ai_persona_name)
    .replaceAll('{{prenom}}',  b.first_name)
    .replaceAll('{{langue}}',  langLabel)
    .replaceAll('{{style}}',   styleDesc)
    .replaceAll('{{il_elle}}', pronoun.subject)
}

/** BLOC CONTEXTE — toujours assemblé par le code, jamais éditable. */
function buildContextBlock(
  beneficiary: BeneficiaryContext,
  memories: MemoryItem[],
  schedule: ScheduleContext,
  previousCall: PreviousCallContext | null,
): string {
  const {
    first_name, birth_year, gender,
    family_history, life_story, hobbies,
    favorite_topics, topics_to_avoid, personality_notes, health_notes,
  } = beneficiary

  const pronoun = GENDER_PRONOUN[gender ?? 'other']

  const topMemories = [...memories]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 15)
  const memoriesText = topMemories.length > 0
    ? topMemories.map((m) => `- [${m.memory_type}] ${m.content}`).join('\n')
    : '(Aucun souvenir enregistré — c\'est peut-être un premier appel)'

  const suggestedTopicsText = schedule.suggested_topics && schedule.suggested_topics.length > 0
    ? schedule.suggested_topics.map((t) => `- ${t}`).join('\n')
    : '(Suivre les centres d\'intérêt habituels de ' + first_name + ')'

  const previousCallText = previousCall
    ? [
        `Date : ${frenchRelativeDate(previousCall.ended_at)}`,
        `Résumé : ${previousCall.summary}`,
        previousCall.key_topics && previousCall.key_topics.length > 0
          ? `Sujets abordés : ${previousCall.key_topics.join(', ')}`
          : '',
        previousCall.memorable_moments && previousCall.memorable_moments.length > 0
          ? `Moments marquants : ${previousCall.memorable_moments.join(' • ')}`
          : '',
      ].filter(Boolean).join('\n')
    : null

  return `═══════════════════════════════════════
INFORMATIONS SUR ${first_name.toUpperCase()}
═══════════════════════════════════════
${birth_year ? `- ${pronoun.adj} en ${birth_year} (${new Date().getFullYear() - birth_year} ans environ)` : ''}
${family_history ? `- Histoire familiale : ${family_history}` : ''}
${life_story ? `- Sa vie : ${life_story}` : ''}
${hobbies ? `- Ce qu'${pronoun.object} aime faire : ${hobbies}` : ''}
${favorite_topics ? `- Sujets de conversation préférés : ${favorite_topics}` : ''}
${topics_to_avoid ? `- À NE PAS aborder absolument : ${topics_to_avoid}` : ''}
${personality_notes ? `- Personnalité : ${personality_notes}` : ''}
${health_notes ? `- Notes utiles : ${health_notes}` : ''}
${previousCallText ? `
═══════════════════════════════════════
VOTRE DERNIÈRE CONVERSATION
═══════════════════════════════════════
${previousCallText}
` : ''}
═══════════════════════════════════════
CE QUE TU TE RAPPELLES DES APPELS PRÉCÉDENTS
═══════════════════════════════════════
${memoriesText}

═══════════════════════════════════════
SUJETS SUGGÉRÉS POUR CET APPEL
═══════════════════════════════════════
${suggestedTopicsText}
${schedule.special_instructions ? `\nInstruction spéciale : ${schedule.special_instructions}` : ''}

Durée cible de cet appel : ${schedule.max_duration_minutes} minutes.`
}

/**
 * Assemble le system prompt complet.
 * @param defaultTemplate  template par défaut (DB `prompt_templates.template`), avec variables
 * @param customPrompt     copie concrète par bénéficiaire (déjà sans variables) ; prioritaire
 */
export function buildSystemPrompt(
  beneficiary: BeneficiaryContext,
  memories: MemoryItem[],
  schedule: ScheduleContext,
  previousCall: PreviousCallContext | null = null,
  defaultTemplate: string | null = null,
  customPrompt: string | null = null,
): string {
  const effectiveTemplate = customPrompt && customPrompt.trim()
    ? customPrompt                                    // déjà concret → tel quel
    : resolvePromptPlaceholders(
        (defaultTemplate && defaultTemplate.trim()) ? defaultTemplate : CODE_DEFAULT_TEMPLATE,
        beneficiary,
      )

  const contextBlock = buildContextBlock(beneficiary, memories, schedule, previousCall)

  return `${effectiveTemplate}\n\n${contextBlock}`
}
