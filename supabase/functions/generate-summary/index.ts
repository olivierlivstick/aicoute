/**
 * Edge Function: generate-summary
 *
 * Rôle : Générer un compte-rendu structuré d'un appel terminé.
 * Input : { call_id: string }
 *
 * Actions :
 *   1. Récupérer le transcript + bénéficiaire + aidant
 *   2. Appeler GPT-4o pour analyser la conversation
 *   3. Sauvegarder summary, mood, topics, alerts dans calls
 *   4. Insérer les nouvelles mémoires dans conversation_memory
 *   5. Marquer calls.report_available = TRUE
 *   6. Envoyer un email de notification à l'aidant
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { sendEmail, reportEmailHtml, normalizeRecipients } from '../_shared/email.ts'
import { issueReportToken } from '../_shared/reportToken.ts'
import { normalizeReportLang, LANG_NAME_FR, MOOD_LABELS, DATE_LOCALE, EMAIL_STRINGS } from '../_shared/reportI18n.ts'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

/**
 * Clé de comparaison pour dédoublonner les mémoires : minuscules, accents
 * retirés, ponctuation/espaces réduits. « Aime le jardinage ! » et « aime le
 * jardinage » donnent la même clé.
 */
function normalizeMemory(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { call_id } = await req.json() as { call_id: string }
    if (!call_id) {
      return jsonResponse({ error: 'call_id requis' }, 400)
    }

    const supabase   = getSupabaseAdmin()
    const openAIKey  = Deno.env.get('OPENAI_API_KEY')!
    const appUrl     = Deno.env.get('VITE_APP_URL') ?? 'https://app.aicoute.fr'

    // 1. Récupérer le call avec le transcript
    const { data: call, error: callErr } = await supabase
      .from('calls')
      .select('*, beneficiaries(*, profiles(full_name, email))')
      .eq('id', call_id)
      .single()

    if (callErr || !call) {
      return jsonResponse({ error: 'Call introuvable' }, 404)
    }

    // Garde-fou anti-hallucination : on n'analyse QUE s'il y a eu un vrai échange,
    // c.-à-d. au moins un tour `user` avec du texte. Un transcript ne contenant que
    // le bonjour de l'IA (ex. répondeur qui décroche, ou appel sans réponse de
    // l'interlocuteur) suffisait à faire confabuler GPT-4o une conversation entière
    // à partir du seul contexte (mémoire, dernier appel) → faux résumé rassurant.
    // On NE génère alors ni résumé fabriqué ni email : on pose un résumé neutre.
    const entries = Array.isArray(call.transcript)
      ? (call.transcript as Array<{ role: string; text: string }>)
      : []
    const userTurns = entries.filter(
      (t) => t.role === 'user' && typeof t.text === 'string' && t.text.trim().length > 0,
    )

    if (entries.length === 0 || userTurns.length === 0) {
      console.warn(`[generate-summary] Pas d'échange réel (entries=${entries.length}, userTurns=${userTurns.length}) pour call ${call_id} — skip analyse + email`)
      await supabase.from('calls').update({
        summary: entries.length === 0
          ? 'La conversation n\'a pas pu être enregistrée.'
          : 'L\'appel a été décroché mais aucun échange n\'a eu lieu (répondeur ou absence de réponse). Aucun compte-rendu n\'a pu être établi.',
        mood_detected:    'neutral',
        report_available: true,
      }).eq('id', call_id)
      return jsonResponse({ success: true, skipped: true, reason: 'no_user_turn' })
    }

    const beneficiary = call.beneficiaries
    const caregiver   = beneficiary?.profiles

    // Langue des RETOURS (résumé/alertes/email, lus par l'aidant) vs langue de
    // CONVERSATION (mémoire long-terme, réinjectée dans les appels → on la garde
    // dans la langue parlée pour que l'IA reste naturelle).
    const reportLang     = normalizeReportLang(beneficiary?.report_language)
    const convLang       = normalizeReportLang(beneficiary?.language_preference)
    const reportLangName = LANG_NAME_FR[reportLang]
    const convLangName   = LANG_NAME_FR[convLang]

    // Mémoires DÉJÀ connues pour ce bénéficiaire → servent à deux choses :
    //   (a) on les donne au modèle pour qu'il ne ré-extraie pas un fait déjà su ;
    //   (b) on en fait un set normalisé pour filtrer les doublons à l'insert.
    // Sans ça, un fait récurrent (« aime le jardinage ») était ré-inséré à chaque
    // appel → accumulation de doublons dans l'onglet Mémoire.
    const { data: existingMemoryRows } = await supabase
      .from('conversation_memory')
      .select('content, importance')
      .eq('beneficiary_id', beneficiary.id)
      .order('importance', { ascending: false })

    const existingMemories = (existingMemoryRows as Array<{ content: string; importance: number }> | null) ?? []
    const existingMemoryKeys = new Set(existingMemories.map((m) => normalizeMemory(m.content)))
    const existingMemoriesBlock = existingMemories.length > 0
      ? existingMemories.slice(0, 40).map((m) => `- ${m.content}`).join('\n')
      : '(aucune mémoire connue pour l\'instant)'

    // 2. Formater le transcript pour GPT-4o
    const transcriptText = (call.transcript as Array<{ role: string; text: string; timestamp: string }>)
      .map((t) => `[${t.role === 'user' ? beneficiary.first_name : beneficiary.ai_persona_name}] ${t.text}`)
      .join('\n')

    // 3. Construire le prompt d'analyse
    const analysisPrompt = `Tu es un assistant bienveillant qui analyse des conversations entre un compagnon IA et une personne âgée pour en extraire un compte-rendu utile à l'aidant familial.

LANGUE DES CHAMPS (IMPÉRATIF) :
- "summary", "key_topics", "memorable_moments" et le champ "evidence" des alertes : rédige-les en ${reportLangName} (langue du compte-rendu destiné à l'aidant).
- "new_memories" (champ "content") : rédige-les en ${convLangName} (langue parlée par la personne, car ces mémoires seront réutilisées lors des prochains appels).
- Les valeurs d'énumération ("mood_detected", "category", "severity", "type") restent dans les codes anglais ci-dessous, ne les traduis PAS.

CONVERSATION À ANALYSER :
${transcriptText}

MÉMOIRES DÉJÀ CONNUES SUR CETTE PERSONNE (enregistrées lors d'appels précédents — NE PAS les redire) :
${existingMemoriesBlock}

INSTRUCTIONS :
Génère un JSON structuré avec EXACTEMENT ces champs (aucun autre) :
{
  "summary": "Résumé narratif de 3 à 5 phrases, ton bienveillant et chaleureux, en ${reportLangName}, destiné à l'aidant",
  "mood_detected": "positive" | "neutral" | "concerned",
  "key_topics": ["thème1", "thème2", ...] (max 6 thèmes courts, en ${reportLangName}),
  "memorable_moments": ["moment1", "moment2", ...] (max 3 moments touchants ou importants, en ${reportLangName}),
  "alerts": [
    {
      "category": "health" | "mood" | "cognition" | "social" | "autonomy" | "other",
      "severity": "low" | "medium" | "high",
      "evidence": "Citation ou paraphrase courte du transcript justifiant le signal, en ${reportLangName}"
    }
  ] (signaux faibles UNIQUEMENT — laisser [] si rien d'inquiétant, max 5),
  "new_memories": [
    { "type": "fact"|"preference"|"event"|"mood"|"topic", "content": "phrase courte à mémoriser, en ${convLangName}", "importance": 1-10 }
  ] (max 8 mémoires utiles pour les prochains appels)
}

RÈGLES POUR LES ALERTES (signaux faibles) :
- N'inclure une alerte QUE si un signal réel est présent. Ne pas surinterpréter.
- category : health (douleur, sommeil, médication, fatigue physique) · mood (tristesse, anxiété, lassitude) · cognition (oublis, confusion, désorientation, mots qui manquent) · social (solitude, isolement, conflit familial) · autonomy (difficulté du quotidien, chute, alimentation) · other (sinon).
- severity : low (mention passagère, signal isolé) · medium (récurrent ou explicite) · high (détresse, danger, demande d'aide).
- evidence : 1 à 2 phrases courtes citant ou paraphrasant le passage du transcript.

RÈGLES POUR LES MÉMOIRES (new_memories) :
- N'inclure QUE des faits RÉELLEMENT NOUVEAUX, ABSENTS de la liste « MÉMOIRES DÉJÀ CONNUES » ci-dessus.
- Ne JAMAIS répéter ni reformuler une mémoire déjà connue (même idée formulée autrement = déjà connue → ne pas la remettre).
- Si la personne reparle d'un sujet déjà mémorisé sans rien ajouter de nouveau, ne créer AUCUNE mémoire pour ce sujet.
- Faits concrets et réutilisables lors d'appels futurs uniquement. La qualité prime sur la quantité : préférer renvoyer "new_memories": [] plutôt que des redites.

RÈGLES GÉNÉRALES :
- mood_detected = "concerned" uniquement si des signaux réels d'inquiétude sont présents
- Si la conversation est très courte ou vide, adapter le résumé en conséquence
- Répondre UNIQUEMENT avec le JSON, sans texte avant ou après`

    // 4. Appeler GPT-4o
    const openAIRes = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:       'gpt-4o',
        messages:    [{ role: 'user', content: analysisPrompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    })

    if (!openAIRes.ok) {
      const err = await openAIRes.text()
      throw new Error(`OpenAI error: ${openAIRes.status} ${err}`)
    }

    const openAIData = await openAIRes.json()
    const rawContent = openAIData.choices?.[0]?.message?.content ?? '{}'

    type AlertCategory = 'health' | 'mood' | 'cognition' | 'social' | 'autonomy' | 'other'
    type AlertSeverity = 'low' | 'medium' | 'high'
    interface RawAlert { category?: string; severity?: string; evidence?: string }

    let result: {
      summary:           string
      mood_detected:     'positive' | 'neutral' | 'concerned'
      key_topics:        string[]
      memorable_moments: string[]
      alerts:            RawAlert[]
      new_memories:      Array<{ type: string; content: string; importance: number }>
    }

    try {
      result = JSON.parse(rawContent)
    } catch {
      throw new Error(`GPT-4o JSON parse failed: ${rawContent}`)
    }

    const ALLOWED_CATEGORIES: AlertCategory[] = ['health', 'mood', 'cognition', 'social', 'autonomy', 'other']
    const ALLOWED_SEVERITIES: AlertSeverity[] = ['low', 'medium', 'high']

    // Valider et sanitiser
    const summary           = result.summary           ?? 'Résumé non disponible.'
    const mood_detected     = ['positive','neutral','concerned'].includes(result.mood_detected)
                              ? result.mood_detected : 'neutral'
    const key_topics        = Array.isArray(result.key_topics)        ? result.key_topics.slice(0, 6)  : []
    const memorable_moments = Array.isArray(result.memorable_moments) ? result.memorable_moments.slice(0, 3) : []
    const new_memories      = Array.isArray(result.new_memories)      ? result.new_memories.slice(0, 8) : []

    const alerts = (Array.isArray(result.alerts) ? result.alerts : [])
      .map((a): { category: AlertCategory; severity: AlertSeverity; evidence: string } => ({
        category: ALLOWED_CATEGORIES.includes(a.category as AlertCategory) ? a.category as AlertCategory : 'other',
        severity: ALLOWED_SEVERITIES.includes(a.severity as AlertSeverity) ? a.severity as AlertSeverity : 'low',
        evidence: typeof a.evidence === 'string' ? a.evidence.slice(0, 500) : '',
      }))
      .filter((a) => a.evidence.length > 0)
      .slice(0, 5)

    // 6. Sauvegarder dans calls
    const { error: updateErr } = await supabase
      .from('calls')
      .update({
        summary,
        mood_detected,
        key_topics,
        memorable_moments,
        alerts,
        report_available: true,
        report_language:  reportLang,   // snapshot pour figer la langue du rapport
      })
      .eq('id', call_id)

    if (updateErr) throw new Error(`Update calls failed: ${updateErr.message}`)

    // 7. Insérer les nouvelles mémoires — filet de sécurité déterministe :
    // on écarte tout fait dont le contenu normalisé existe DÉJÀ en base
    // (existingMemoryKeys) ou apparaît deux fois dans le même lot (seenInBatch),
    // au cas où le modèle aurait quand même produit une redite.
    if (new_memories.length > 0) {
      const seenInBatch = new Set<string>()
      const memoryInserts = new_memories
        .filter((m) => m.content && m.type)
        .filter((m) => {
          const key = normalizeMemory(m.content)
          if (!key || existingMemoryKeys.has(key) || seenInBatch.has(key)) return false
          seenInBatch.add(key)
          return true
        })
        .map((m) => ({
          beneficiary_id: beneficiary.id,
          memory_type:    m.type,
          content:        m.content,
          importance:     Math.max(1, Math.min(10, m.importance ?? 5)),
          source_call_id: call_id,
        }))

      if (memoryInserts.length > 0) {
        const { error: memErr } = await supabase
          .from('conversation_memory')
          .insert(memoryInserts)
        if (memErr) console.error('[generate-summary] Memory insert error:', memErr.message)
      }
    }

    // 8. Envoyer l'email de notification à l'aidant
    //    Trois conditions cumulatives :
    //      - le bénéficiaire a opt-in (notify_call_report)
    //      - l'aidant a un email
    //      - le rapport n'a pas déjà été envoyé (idempotence sur report_email_sent_at)
    const alreadySent     = !!call.report_email_sent_at
    const notifyOptIn     = beneficiary.notify_call_report !== false  // default TRUE
    // Appels de CAMPAGNE (org) : PAS d'email par appel (cela spammerait une boîte
    // unique sur des centaines d'appels). Les signaux remontent dans /org/signaux ;
    // le compte-rendu reste consultable. Le résumé + les alertes sont quand même
    // calculés et stockés ci-dessus.
    const isCampaignCall  = call.origin === 'campaign'
    let   reportEmailSent = false

    // Destinataires : aidant (en premier) + proches déclarés sur le bénéficiaire
    // (beneficiaries.report_recipients). Validés + dédoublonnés.
    const recipients = normalizeRecipients([
      caregiver?.email,
      ...(Array.isArray(beneficiary.report_recipients) ? beneficiary.report_recipients : []),
    ])

    if (notifyOptIn && !isCampaignCall && recipients.length > 0 && !alreadySent) {
      const callDate = new Date(call.ended_at ?? call.scheduled_at)
      const durationMin = call.duration_seconds
        ? Math.round(call.duration_seconds / 60)
        : 0

      const dateFormatted = callDate.toLocaleDateString(DATE_LOCALE[reportLang], {
        weekday: 'long', day: 'numeric', month: 'long',
        hour: '2-digit', minute: '2-digit',
      })

      const moodLabel = MOOD_LABELS[reportLang][mood_detected]

      // Jeton de partage public (page /r/:token, valable 48h) — émis juste
      // avant l'envoi pour que la fenêtre court à partir de l'email reçu.
      const { url: reportUrl } = await issueReportToken(supabase, call_id)

      const ok = await sendEmail({
        to:      recipients,
        subject: EMAIL_STRINGS[reportLang].subject(beneficiary.first_name, moodLabel, mood_detected === 'concerned'),
        html: reportEmailHtml({
          caregiver_name:   caregiver.full_name ?? 'Aidant',
          beneficiary_name: `${beneficiary.first_name} ${beneficiary.last_name}`,
          call_date:        dateFormatted,
          duration_min:     durationMin,
          mood_label:       moodLabel,
          summary,
          key_topics,
          alerts,
          app_url:          appUrl,
          report_url:       reportUrl,
          lang:             reportLang,
        }),
      })

      // Marquer envoyé uniquement si Resend a accepté
      if (ok) {
        reportEmailSent = true
        await supabase
          .from('calls')
          .update({ report_email_sent_at: new Date().toISOString() })
          .eq('id', call_id)
      }
    } else if (alreadySent) {
      console.log(`[generate-summary] Email déjà envoyé pour call ${call_id}, skip.`)
    } else if (!notifyOptIn) {
      console.log(`[generate-summary] Bénéficiaire ${beneficiary.id} a opt-out (notify_call_report=false), skip email.`)
    }

    console.log(`[generate-summary] ✓ Call ${call_id} traité — mood: ${mood_detected}, ${new_memories.length} mémoires`)

    return jsonResponse({
      success:           true,
      call_id,
      mood_detected,
      memories_added:    new_memories.length,
      report_email_sent: reportEmailSent,
    })

  } catch (err) {
    console.error('[generate-summary] Erreur:', err)
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Erreur interne' },
      500,
    )
  }
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
