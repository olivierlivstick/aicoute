#!/usr/bin/env node
/**
 * Test tronqué de la chaîne « rapport post-appel » sans Twilio ni OpenAI.
 *
 * Ce qu'on teste :
 *   1. INSERT direct d'un call en 'in_progress' avec un transcript synthétique
 *   2. POST save-transcript → déclenche generate-summary en arrière-plan
 *   3. Poll jusqu'à voir 'completed' + 'report_available' + 'report_email_sent_at'
 *   4. Vérifie que summary, alerts et report_email_sent_at sont bien remplis
 *
 * Ce qu'on NE teste PAS (volontairement, cf. CLAUDE.md) :
 *   - Twilio (vrai appel sortant + audio streaming)
 *   - OpenAI Realtime (génération audio en live)
 *   - Pg_cron / passes A/B/C de schedule-calls
 *
 * Variables d'environnement requises :
 *   SUPABASE_URL                    = URL du projet (ex: https://xxx.supabase.co)
 *   SUPABASE_SERVICE_ROLE_KEY       = clé service-role (by-pass RLS)
 *   TEST_CAREGIVER_EMAIL            = email d'un aidant existant (servira de propriétaire au bénéficiaire test)
 *   TEST_BENEFICIARY_PHONE          = numéro factice (ex: +33000000001) — pas appelé, juste écrit
 *
 * Usage :
 *   node scripts/test-email-report.mjs
 *   ou : npm run test:email-report
 *
 * Exit code 0 = succès, 1 = échec (avec message explicite).
 */

const SUPABASE_URL              = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TEST_CAREGIVER_EMAIL      = process.env.TEST_CAREGIVER_EMAIL
const TEST_BENEFICIARY_PHONE    = process.env.TEST_BENEFICIARY_PHONE ?? '+33000000001'

function fail(msg) {
  console.error(`❌ ${msg}`)
  process.exit(1)
}

if (!SUPABASE_URL)              fail('SUPABASE_URL manquant')
if (!SUPABASE_SERVICE_ROLE_KEY) fail('SUPABASE_SERVICE_ROLE_KEY manquant')
if (!TEST_CAREGIVER_EMAIL)      fail('TEST_CAREGIVER_EMAIL manquant')

const REST_HEADERS = {
  'apikey':        SUPABASE_SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type':  'application/json',
  'Prefer':        'return=representation',
}

async function rest(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { ...REST_HEADERS, ...(options.headers ?? {}) },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`REST ${path} HTTP ${res.status}: ${text.slice(0, 500)}`)
  return text ? JSON.parse(text) : null
}

async function invokeFn(fnName, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method:  'POST',
    headers: REST_HEADERS,
    body:    JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Edge Fn ${fnName} HTTP ${res.status}: ${text.slice(0, 500)}`)
  return text ? JSON.parse(text) : null
}

function ts(n) { return new Date(Date.now() + n * 1000).toISOString() }
function shortId(s) { return s.slice(0, 8) }

const TRANSCRIPT = [
  { role: 'assistant', text: 'Bonjour ! Comment allez-vous aujourd\'hui ?',                                        timestamp: ts(0)  },
  { role: 'user',      text: 'Bonjour, ça va à peu près. J\'ai un peu mal au dos depuis hier.',                      timestamp: ts(2)  },
  { role: 'assistant', text: 'Je suis désolé d\'entendre ça. Avez-vous pu vous reposer ?',                          timestamp: ts(5)  },
  { role: 'user',      text: 'Oui un peu, j\'ai pris mon paracétamol. Sinon j\'ai vu ma fille hier, ça m\'a fait plaisir.', timestamp: ts(8)  },
  { role: 'assistant', text: 'C\'est merveilleux. Racontez-moi un peu votre rencontre ?',                            timestamp: ts(12) },
  { role: 'user',      text: 'On a déjeuné ensemble. Elle m\'a apporté des fleurs.',                                 timestamp: ts(15) },
]

async function main() {
  console.log('🧪 Test email-report — démarre')

  // 1. Récupérer un aidant existant
  const caregivers = await rest(`profiles?email=eq.${encodeURIComponent(TEST_CAREGIVER_EMAIL)}&select=id,full_name`)
  if (!caregivers || caregivers.length === 0) fail(`Aucun profil ne correspond à TEST_CAREGIVER_EMAIL=${TEST_CAREGIVER_EMAIL}`)
  const caregiver = caregivers[0]
  console.log(`   → aidant: ${caregiver.full_name} (id=${shortId(caregiver.id)}…)`)

  // 2. Créer un bénéficiaire test (sera supprimé en fin)
  const bens = await rest('beneficiaries', {
    method: 'POST',
    body:   JSON.stringify({
      caregiver_id:       caregiver.id,
      first_name:         'Test',
      last_name:          `EmailReport-${Date.now()}`,
      phone:              TEST_BENEFICIARY_PHONE,
      language_preference:'fr',
      ai_persona_name:    'Marie',
      conversation_style: 'warm',
      notify_call_report: true,
      is_active:          true,
    }),
  })
  const beneficiary = bens[0]
  console.log(`   → bénéficiaire test créé: ${shortId(beneficiary.id)}…`)

  let callId = null
  try {
    // 3. Créer un call simulé
    const calls = await rest('calls', {
      method: 'POST',
      body:   JSON.stringify({
        beneficiary_id: beneficiary.id,
        status:         'in_progress',
        scheduled_at:   new Date().toISOString(),
        started_at:     new Date().toISOString(),
        attempt_number: 1,
      }),
    })
    callId = calls[0].id
    console.log(`   → call créé en in_progress: ${shortId(callId)}…`)

    // 4. POST save-transcript (chaîne generate-summary)
    console.log('   → POST save-transcript')
    const saveRes = await invokeFn('save-transcript', {
      call_id:          callId,
      transcript:       TRANSCRIPT,
      duration_seconds: 18,
      status:           'completed',
    })
    if (!saveRes?.success) fail(`save-transcript a renvoyé ${JSON.stringify(saveRes)}`)

    // 5. Poll jusqu'à voir le rapport (max 30s, intervalle 2s)
    console.log('   → poll generate-summary (max 30s)…')
    let final = null
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      const rows = await rest(`calls?id=eq.${callId}&select=status,summary,alerts,report_available,report_email_sent_at`)
      const row = rows[0]
      if (row.report_available && row.report_email_sent_at) {
        final = row
        break
      }
    }
    if (!final) fail('Délai dépassé (30s) : report_email_sent_at n\'a jamais été marqué.')

    // 6. Assertions
    if (final.status !== 'completed')           fail(`Status final attendu 'completed', reçu '${final.status}'`)
    if (!final.summary || final.summary.length < 20) fail(`Summary vide ou trop court (${final.summary?.length ?? 0} chars)`)
    if (!Array.isArray(final.alerts))           fail('alerts doit être un array')

    console.log('   ✅ Tout est OK !')
    console.log(`      - status:               ${final.status}`)
    console.log(`      - summary (${final.summary.length} chars): ${final.summary.slice(0, 120)}${final.summary.length > 120 ? '…' : ''}`)
    console.log(`      - alerts:               ${final.alerts.length} signal(aux)`)
    console.log(`      - report_email_sent_at: ${final.report_email_sent_at}`)

  } finally {
    // 7. Cleanup
    if (callId) {
      await rest(`calls?id=eq.${callId}`, { method: 'DELETE' }).catch(() => {})
    }
    await rest(`beneficiaries?id=eq.${beneficiary.id}`, { method: 'DELETE' }).catch(() => {})
    console.log('   → cleanup OK')
  }
}

main().catch((err) => fail(err.message))
