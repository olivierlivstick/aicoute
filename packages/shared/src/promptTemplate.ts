/**
 * Résolution des variables d'un template de prompt → texte concret.
 *
 * Utilisé côté web pour « dupliquer » le prompt par défaut dans un bénéficiaire
 * à la création (snapshot concret, sans variables) et pour le bouton
 * « Réinitialiser depuis le défaut ».
 *
 * ⚠️ Une copie de cette logique existe côté Edge (supabase/functions/_shared/
 * systemPrompt.ts → resolvePromptPlaceholders) car Deno n'importe pas
 * packages/shared. GARDER LES DEUX EN PHASE (mappings de style + pronoms).
 */

/**
 * Prompt par défaut CANONIQUE (avec variables). Sert de baseline pour le bouton
 * « Réinitialiser » de /admin/prompt et de filet si la table prompt_templates
 * renvoie du vide. GARDER EN PHASE avec le seed migration + CODE_DEFAULT_TEMPLATE (edge).
 */
export const DEFAULT_PROMPT_TEMPLATE = `Tu es {{persona}}, un compagnon bienveillant et chaleureux qui appelle {{prenom}} pour bavarder.
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

export const STYLE_DESCRIPTIONS: Record<string, string> = {
  warm:    'chaleureux, bienveillant et affectueux',
  playful: "enjoué, léger et plein d'humour doux",
  calm:    'calme, posé et rassurant',
  formal:  'respectueux et traditionnel, en vouvoyant',
}

export const GENDER_PRONOUN: Record<string, { subject: string; object: string; adj: string }> = {
  female: { subject: 'elle', object: 'la', adj: 'née' },
  male:   { subject: 'il',   object: 'le', adj: 'né' },
  other:  { subject: 'il/elle', object: 'le/la', adj: 'né(e)' },
}

export function langLabel(language_preference: string): string {
  return language_preference === 'fr' ? 'français' : language_preference
}

export interface PromptResolveInput {
  first_name: string
  ai_persona_name: string
  conversation_style: string
  language_preference: string
  gender: string | null
}

/**
 * Remplace {{persona}} {{prenom}} {{langue}} {{style}} {{il_elle}} par les
 * valeurs concrètes. Les variables inconnues sont laissées telles quelles.
 */
export function resolvePromptPlaceholders(template: string, b: PromptResolveInput): string {
  const styleDesc = STYLE_DESCRIPTIONS[b.conversation_style] ?? 'chaleureux et bienveillant'
  const pronoun   = GENDER_PRONOUN[b.gender ?? 'other'] ?? GENDER_PRONOUN.other
  return template
    .replaceAll('{{persona}}', b.ai_persona_name)
    .replaceAll('{{prenom}}',  b.first_name)
    .replaceAll('{{langue}}',  langLabel(b.language_preference))
    .replaceAll('{{style}}',   styleDesc)
    .replaceAll('{{il_elle}}', pronoun.subject)
}
