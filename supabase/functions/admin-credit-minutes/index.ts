/**
 * Edge Function: admin-credit-minutes
 *
 * Crédite manuellement des minutes au compte d'un aidant (geste commercial,
 * cadeau, test prolongé…). Écrit une ligne dans minute_adjustments.
 *
 *  POST { caregiver_id, minutes, reason }  → { ok: true, minutes }
 *
 * Réservé aux admins (requireAdmin sur le JWT appelant). L'écriture se fait en
 * service-role : le client n'a aucun droit d'INSERT sur minute_adjustments.
 * verify_jwt = false (auth gérée en interne, comme admin-update-caregiver).
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { requireAdmin } from '../_shared/requireAdmin.ts'

const MAX_MINUTES = 100000  // garde-fou anti-faute de frappe
const MAX_REASON_LEN = 280

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'méthode non autorisée' }, 405)
  }

  try {
    const admin = getSupabaseAdmin()

    const auth = await requireAdmin(req, admin)
    if ('error' in auth) return jsonResponse({ error: auth.error }, auth.status)

    const body = await req.json().catch(() => ({}))
    const caregiverId = String(body?.caregiver_id ?? '').trim()
    const minutes = Number(body?.minutes)
    const reason = String(body?.reason ?? '').trim()

    if (!caregiverId) return jsonResponse({ error: 'Aidant manquant.' }, 400)
    if (!Number.isInteger(minutes) || minutes <= 0) {
      return jsonResponse({ error: 'Le nombre de minutes doit être un entier positif.' }, 400)
    }
    if (minutes > MAX_MINUTES) {
      return jsonResponse({ error: `Maximum ${MAX_MINUTES} minutes par opération.` }, 400)
    }
    if (!reason) return jsonResponse({ error: 'Un motif est requis.' }, 400)
    if (reason.length > MAX_REASON_LEN) {
      return jsonResponse({ error: 'Motif trop long.' }, 400)
    }

    // Vérifie que l'aidant existe.
    const { data: prof, error: profErr } = await admin
      .from('profiles')
      .select('id')
      .eq('id', caregiverId)
      .maybeSingle()
    if (profErr) throw new Error(profErr.message)
    if (!prof) return jsonResponse({ error: 'Aidant introuvable.' }, 404)

    const { error: insErr } = await admin.from('minute_adjustments').insert({
      caregiver_id: caregiverId,
      minutes,
      reason,
      created_by: auth.userId,
    })
    if (insErr) throw new Error(insErr.message)

    return jsonResponse({ ok: true, minutes })
  } catch (err) {
    console.error('[admin-credit-minutes] Erreur:', err)
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
