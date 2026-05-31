/**
 * Tests unitaires de buildSystemPrompt / resolvePromptPlaceholders / frenchRelativeDate.
 * Run : deno test supabase/functions/_shared/
 */

import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  buildSystemPrompt,
  resolvePromptPlaceholders,
  frenchRelativeDate,
  CODE_DEFAULT_TEMPLATE,
} from './systemPrompt.ts'

const beneficiary = {
  first_name:          'Raphael',
  birth_year:          1940,
  gender:              'male',
  family_history:      null,
  life_story:          null,
  hobbies:             null,
  favorite_topics:     null,
  topics_to_avoid:     null,
  personality_notes:   null,
  health_notes:        null,
  language_preference: 'fr',
  ai_persona_name:     'Léa',
  conversation_style:  'warm',
}

const schedule = { max_duration_minutes: 15, suggested_topics: null, special_instructions: null }

const previous = {
  ended_at:          new Date(2026, 4, 29, 15, 0, 0).toISOString(),
  summary:           'Raphael a parlé de son déjeuner avec sa femme Coco.',
  key_topics:        ['déjeuner', 'famille'],
  memorable_moments: ['A évoqué Coco avec tendresse'],
}

// --- frenchRelativeDate ------------------------------------------------------

Deno.test('frenchRelativeDate — aujourd\'hui / hier / il y a N jours / date longue', () => {
  const now = new Date(2026, 4, 31, 10, 0, 0)
  assertEquals(frenchRelativeDate(new Date(2026, 4, 31, 8, 0, 0).toISOString(), now), "aujourd'hui")
  assertEquals(frenchRelativeDate(new Date(2026, 4, 30, 23, 0, 0).toISOString(), now), 'hier')
  assertEquals(frenchRelativeDate(new Date(2026, 4, 28, 9, 0, 0).toISOString(), now), 'il y a 3 jours')
  assertEquals(frenchRelativeDate(new Date(2026, 4, 20, 9, 0, 0).toISOString(), now), 'le 20 mai')
})

Deno.test('frenchRelativeDate — null / invalide → "récemment"', () => {
  assertEquals(frenchRelativeDate(null), 'récemment')
  assertEquals(frenchRelativeDate('pas-une-date'), 'récemment')
})

// --- resolvePromptPlaceholders ----------------------------------------------

Deno.test('resolvePromptPlaceholders — remplace toutes les variables, ne laisse aucun {{', () => {
  const out = resolvePromptPlaceholders(CODE_DEFAULT_TEMPLATE, beneficiary)
  assert(!out.includes('{{'), 'aucune variable {{}} ne doit subsister')
  assertStringIncludes(out, 'Tu es Léa,')
  assertStringIncludes(out, 'appelle Raphael')
  assertStringIncludes(out, 'en français')
  assertStringIncludes(out, 'chaleureux, bienveillant et affectueux')
  assertStringIncludes(out, 'comment il va') // {{il_elle}} = il (male)
})

Deno.test('resolvePromptPlaceholders — variable inconnue laissée telle quelle', () => {
  assertEquals(resolvePromptPlaceholders('Bonjour {{prenom}} {{inconnu}}', beneficiary), 'Bonjour Raphael {{inconnu}}')
})

// --- buildSystemPrompt : chemin DÉFAUT (pas de custom) -----------------------

Deno.test('buildSystemPrompt — défaut interpolé + bloc contexte', () => {
  const prompt = buildSystemPrompt(beneficiary, [], schedule, previous, null, null)
  assert(!prompt.includes('{{'), 'le défaut doit être interpolé (aucun {{}})')
  assertStringIncludes(prompt, 'Tu es Léa,')                       // template résolu
  assertStringIncludes(prompt, 'INFORMATIONS SUR RAPHAEL')         // bloc contexte
  assertStringIncludes(prompt, 'VOTRE DERNIÈRE CONVERSATION')      // previousCall
  assertStringIncludes(prompt, 'déjeuner avec sa femme Coco')
  assertStringIncludes(prompt, 'Durée cible de cet appel : 15 minutes.')
})

Deno.test('buildSystemPrompt — defaultTemplate fourni est utilisé et interpolé', () => {
  const tpl = 'PROMPT ADMIN pour {{prenom}} par {{persona}}.'
  const prompt = buildSystemPrompt(beneficiary, [], schedule, null, tpl, null)
  assertStringIncludes(prompt, 'PROMPT ADMIN pour Raphael par Léa.')
  assert(!prompt.includes('COMPAGNON DE CONVERSATION'), 'ne doit pas contenir le défaut codé')
})

// --- buildSystemPrompt : chemin CUSTOM (par bénéficiaire) --------------------

Deno.test('buildSystemPrompt — custom_prompt prioritaire, utilisé verbatim + bloc contexte', () => {
  const custom = 'Tu es un compagnon spécial pour Mme X. Parle lentement et répète.'
  const prompt = buildSystemPrompt(beneficiary, [], schedule, previous, CODE_DEFAULT_TEMPLATE, custom)
  assertStringIncludes(prompt, custom)                            // verbatim
  assert(!prompt.includes('Tu es Léa,'), 'ne doit pas utiliser le défaut quand custom présent')
  assertStringIncludes(prompt, 'VOTRE DERNIÈRE CONVERSATION')     // bloc contexte toujours là
  assertStringIncludes(prompt, 'Durée cible de cet appel : 15 minutes.')
})

Deno.test('buildSystemPrompt — custom_prompt vide → fallback défaut', () => {
  const prompt = buildSystemPrompt(beneficiary, [], schedule, null, null, '   ')
  assertStringIncludes(prompt, 'Tu es Léa,')
})
