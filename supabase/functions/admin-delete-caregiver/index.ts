/**
 * Edge Function: admin-delete-caregiver
 *
 * Rôle : supprimer définitivement un compte aidant depuis /admin/comptes/:id.
 * Réservé aux admins (vérif JWT + rôle).
 *
 * Input : { id }
 *
 * Garde-fou « pas de bénéficiaires orphelins » : on REFUSE (409) la suppression
 * d'un aidant qui a encore au moins un bénéficiaire. La FK beneficiaries.caregiver_id
 * est en ON DELETE CASCADE → sans ce garde-fou, supprimer l'aidant effacerait
 * silencieusement tous ses bénéficiaires (et leur historique). L'admin doit donc
 * d'abord réassigner ou supprimer les bénéficiaires.
 *
 * Suppression réelle : on supprime auth.users (service role) → cascade vers
 * profiles. Supprimer la seule ligne profiles laisserait un compte fantôme
 * capable de se reconnecter.
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { requireAdmin } from '../_shared/requireAdmin.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const admin = getSupabaseAdmin()

    const auth = await requireAdmin(req, admin)
    if ('error' in auth) return jsonResponse({ error: auth.error }, auth.status)

    const { id } = await req.json() as { id: string }
    if (!id) return jsonResponse({ error: 'id requis' }, 400)

    // Empêche un admin de se supprimer lui-même par accident
    if (id === auth.userId) {
      return jsonResponse({ error: 'Vous ne pouvez pas supprimer votre propre compte.' }, 400)
    }

    // Garde-fou : refuser si l'aidant a des bénéficiaires
    const { count, error: countErr } = await admin
      .from('beneficiaries')
      .select('id', { count: 'exact', head: true })
      .eq('caregiver_id', id)
    if (countErr) return jsonResponse({ error: `Échec du comptage : ${countErr.message}` }, 500)

    if ((count ?? 0) > 0) {
      return jsonResponse({
        error: `Impossible de supprimer cet aidant : il a encore ${count} bénéficiaire(s). Supprimez-les ou réassignez-les d'abord.`,
        beneficiaries: count,
      }, 409)
    }

    // Suppression de l'utilisateur auth → cascade vers profiles
    const { error: delErr } = await admin.auth.admin.deleteUser(id)
    if (delErr) return jsonResponse({ error: `Échec suppression : ${delErr.message}` }, 500)

    return jsonResponse({ success: true })
  } catch (err) {
    console.error('[admin-delete-caregiver] Erreur:', err)
    return jsonResponse({ error: err instanceof Error ? err.message : 'Erreur interne' }, 500)
  }
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
