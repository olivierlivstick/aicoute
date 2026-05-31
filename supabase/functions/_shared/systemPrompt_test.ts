/**
 * Tests unitaires de buildSystemPrompt / frenchRelativeDate.
 * Run : deno test supabase/functions/_shared/
 */

import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { buildSystemPrompt, frenchRelativeDate } from './systemPrompt.ts'

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

// --- frenchRelativeDate ------------------------------------------------------

Deno.test('frenchRelativeDate — aujourd\'hui / hier / il y a N jours / date longue', () => {
  const now = new Date(2026, 4, 31, 10, 0, 0) // 31 mai 2026
  assertEquals(frenchRelativeDate(new Date(2026, 4, 31, 8, 0, 0).toISOString(), now), "aujourd'hui")
  assertEquals(frenchRelativeDate(new Date(2026, 4, 30, 23, 0, 0).toISOString(), now), 'hier')
  assertEquals(frenchRelativeDate(new Date(2026, 4, 28, 9, 0, 0).toISOString(), now), 'il y a 3 jours')
  assertEquals(frenchRelativeDate(new Date(2026, 4, 20, 9, 0, 0).toISOString(), now), 'le 20 mai')
})

Deno.test('frenchRelativeDate — null / invalide → "récemment"', () => {
  assertEquals(frenchRelativeDate(null), 'récemment')
  assertEquals(frenchRelativeDate('pas-une-date'), 'récemment')
})

// --- buildSystemPrompt : bloc "dernière conversation" ------------------------

Deno.test('buildSystemPrompt — previousCall présent → bloc rendu + consigne clin d\'œil', () => {
  const prompt = buildSystemPrompt(beneficiary, [], schedule, {
    ended_at:          new Date(2026, 4, 29, 15, 0, 0).toISOString(),
    summary:           'Raphael a parlé de son déjeuner avec sa femme Coco.',
    key_topics:        ['déjeuner', 'famille'],
    memorable_moments: ['A évoqué Coco avec tendresse'],
  })
  assertStringIncludes(prompt, 'VOTRE DERNIÈRE CONVERSATION')
  assertStringIncludes(prompt, 'Résumé : Raphael a parlé de son déjeuner')
  assertStringIncludes(prompt, 'Sujets abordés : déjeuner, famille')
  assertStringIncludes(prompt, 'Moments marquants : A évoqué Coco avec tendresse')
  assertStringIncludes(prompt, "clin d'œil") // règle 1 augmentée
})

Deno.test('buildSystemPrompt — previousCall null → bloc absent + ouverture simple', () => {
  const prompt = buildSystemPrompt(beneficiary, [], schedule)
  assert(!prompt.includes('VOTRE DERNIÈRE CONVERSATION'))
  assert(!prompt.includes("clin d'œil"))
  assertStringIncludes(prompt, 'Commence par un bonjour chaleureux')
})

Deno.test('buildSystemPrompt — key_topics/memorable_moments vides → lignes omises', () => {
  const prompt = buildSystemPrompt(beneficiary, [], schedule, {
    ended_at:          new Date(2026, 4, 29).toISOString(),
    summary:           'Court échange.',
    key_topics:        [],
    memorable_moments: null,
  })
  assertStringIncludes(prompt, 'VOTRE DERNIÈRE CONVERSATION')
  assert(!prompt.includes('Sujets abordés :'))
  assert(!prompt.includes('Moments marquants :'))
})
