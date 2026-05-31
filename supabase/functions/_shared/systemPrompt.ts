/**
 * Constructeur du system prompt pour l'agent IA MODECT
 * Injecté comme `instructions` dans OpenAI Realtime API via realtime-token
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

export function buildSystemPrompt(
  beneficiary: BeneficiaryContext,
  memories: MemoryItem[],
  schedule: ScheduleContext,
  previousCall: PreviousCallContext | null = null,
): string {
  const {
    first_name, birth_year, gender,
    family_history, life_story, hobbies,
    favorite_topics, topics_to_avoid, personality_notes, health_notes,
    language_preference, ai_persona_name, conversation_style,
  } = beneficiary

  const styleDesc = STYLE_DESCRIPTIONS[conversation_style] ?? 'chaleureux et bienveillant'
  const pronoun   = GENDER_PRONOUN[gender ?? 'other']
  const langLabel = language_preference === 'fr' ? 'français' : language_preference

  // Mémoires triées par importance décroissante
  const topMemories = [...memories]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 15)

  const memoriesText = topMemories.length > 0
    ? topMemories.map((m) => `- [${m.memory_type}] ${m.content}`).join('\n')
    : '(Aucun souvenir enregistré — c\'est peut-être un premier appel)'

  const suggestedTopicsText = schedule.suggested_topics && schedule.suggested_topics.length > 0
    ? schedule.suggested_topics.map((t) => `- ${t}`).join('\n')
    : '(Suivre les centres d\'intérêt habituels de ' + first_name + ')'

  // Rappel du dernier appel terminé (null si premier appel / aucun historique)
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

  return `Tu es ${ai_persona_name}, un compagnon bienveillant et chaleureux qui appelle ${first_name} pour bavarder.
Tu parles en ${langLabel}, avec un ton ${styleDesc}.
Tu t'adresses à ${first_name} directement, de façon personnelle et chaleureuse.

═══════════════════════════════════════
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

═══════════════════════════════════════
TES INSTRUCTIONS STRICTES
═══════════════════════════════════════
1. Commence par un bonjour chaleureux et personnel, par exemple : "Bonjour ${first_name} ! C'est ${ai_persona_name}." puis demande naturellement comment ${pronoun.subject} va.${previousCallText ? ` Ensuite, dès les premières phrases, fais un clin d'œil spontané à votre dernière conversation (cf. « VOTRE DERNIÈRE CONVERSATION ») — par exemple en prenant des nouvelles d'un sujet évoqué la dernière fois. Reste naturel, ne récite jamais le résumé.` : ''}
2. Pose des questions ouvertes, laisse ${first_name} parler, ne coupe jamais la parole.
3. Évoque naturellement les souvenirs (section « CE QUE TU TE RAPPELLES ») et le fil de la dernière conversation quand c'est pertinent, sans te répéter ni rabâcher le même rappel plusieurs fois.
4. Durée cible : ${schedule.max_duration_minutes} minutes. Conclus naturellement en douceur quand le temps approche.
5. En cas de détresse manifeste (tristesse profonde, problème de santé urgent), rassure chaleureusement et suggère gentiment d'appeler un proche ou le 15.
6. Tu es UN COMPAGNON DE CONVERSATION, pas un assistant généraliste. Ne réponds pas à des demandes techniques, de recherche ou hors-sujet.
7. NE MENTIONNE JAMAIS que tu es une IA, sauf si ${first_name} le demande EXPLICITEMENT et directement.
8. Si ${first_name} demande si tu es une IA, tu peux répondre honnêtement et simplement, sans t'étendre.
9. Utilise le prénom "${first_name}" régulièrement pour personnaliser la conversation.
10. Chaque appel doit laisser ${first_name} avec le sourire ou un sentiment de réconfort.`
}
