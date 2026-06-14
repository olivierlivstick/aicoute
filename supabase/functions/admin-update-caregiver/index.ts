/**
 * Edge Function: admin-update-caregiver
 *
 * Rôle : éditer un compte aidant depuis le back-office /admin/comptes/:id.
 * Réservé aux admins (vérif JWT + rôle).
 *
 * Input : { id, account_type?, first_name?, last_name?, company_name?, email?,
 *           phone?, timezone?, address_line?, postal_code?, city?, country? }
 *   - `role` n'est volontairement PAS modifiable (lecture seule côté UI).
 *   - `full_name` est recalculé côté serveur à partir de l'identité structurée
 *     (raison sociale pour une personne morale, « prénom nom » sinon) — miroir
 *     de computeFullName() de @modect/shared (Deno n'importe pas le package).
 *   - Si `email` change, il est propagé à auth.users.email (service role) en
 *     plus de profiles.email — sinon l'email de connexion resterait l'ancien.
 *
 * Pourquoi une Edge Function plutôt que la RLS : changer auth.users.email exige
 * l'API admin (service role), impossible depuis le client navigateur.
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { requireAdmin } from '../_shared/requireAdmin.ts'

type AccountType = 'individual' | 'organization'

interface Payload {
  id:            string
  account_type?: AccountType
  first_name?:   string | null
  last_name?:    string | null
  company_name?: string | null
  full_name?:    string
  email?:        string
  phone?:        string | null
  timezone?:     string
  address_line?: string | null
  postal_code?:  string | null
  city?:         string | null
  country?:      string | null
}

/** Miroir de computeFullName() (@modect/shared). */
function computeFullName(p: Pick<Payload, 'account_type' | 'first_name' | 'last_name' | 'company_name'>): string {
  if (p.account_type === 'organization') return (p.company_name ?? '').trim()
  return [p.first_name, p.last_name].map((s) => (s ?? '').trim()).filter(Boolean).join(' ')
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const admin = getSupabaseAdmin()

    const auth = await requireAdmin(req, admin)
    if ('error' in auth) return jsonResponse({ error: auth.error }, auth.status)

    const body = await req.json() as Payload
    if (!body?.id) return jsonResponse({ error: 'id requis' }, 400)

    // Récupère la cible pour comparer l'email actuel
    const { data: target, error: targetErr } = await admin
      .from('profiles')
      .select('id, email')
      .eq('id', body.id)
      .single()
    if (targetErr || !target) return jsonResponse({ error: 'Compte introuvable' }, 404)

    // 1. Propager le changement d'email à auth.users si nécessaire
    const newEmail = body.email?.trim()
    const emailChanged = !!newEmail && newEmail !== target.email
    if (emailChanged) {
      const { error: authErr } = await admin.auth.admin.updateUserById(body.id, {
        email:         newEmail,
        email_confirm: true, // admin force la confirmation, pas de mail de validation
      })
      if (authErr) {
        return jsonResponse({ error: `Échec mise à jour email auth : ${authErr.message}` }, 422)
      }
    }

    // 2. Mettre à jour profiles (role exclu volontairement)
    const patch: Record<string, unknown> = {}
    if (body.account_type !== undefined) patch.account_type = body.account_type
    if (body.first_name !== undefined)   patch.first_name = body.first_name || null
    if (body.last_name !== undefined)    patch.last_name = body.last_name || null
    if (body.company_name !== undefined) {
      patch.company_name = body.account_type === 'organization' ? (body.company_name || null) : null
    }
    if (body.phone !== undefined)        patch.phone = body.phone || null
    if (body.timezone !== undefined)     patch.timezone = body.timezone
    if (body.address_line !== undefined) patch.address_line = body.address_line || null
    if (body.postal_code !== undefined)  patch.postal_code = body.postal_code || null
    if (body.city !== undefined)         patch.city = body.city || null
    if (body.country !== undefined)      patch.country = body.country || null
    if (emailChanged)                    patch.email = newEmail

    // full_name recalculé dès qu'un champ d'identité est fourni.
    if (body.account_type !== undefined || body.first_name !== undefined ||
        body.last_name !== undefined || body.company_name !== undefined) {
      patch.full_name = computeFullName(body)
    } else if (body.full_name !== undefined) {
      patch.full_name = body.full_name
    }

    if (Object.keys(patch).length > 0) {
      const { error: updateErr } = await admin.from('profiles').update(patch).eq('id', body.id)
      if (updateErr) return jsonResponse({ error: `Échec mise à jour profil : ${updateErr.message}` }, 500)
    }

    return jsonResponse({ success: true, email_changed: emailChanged })
  } catch (err) {
    console.error('[admin-update-caregiver] Erreur:', err)
    return jsonResponse({ error: err instanceof Error ? err.message : 'Erreur interne' }, 500)
  }
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
