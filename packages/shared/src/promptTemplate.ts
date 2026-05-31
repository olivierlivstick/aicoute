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
