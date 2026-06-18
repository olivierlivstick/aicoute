/**
 * Edge Function: admin-prompts
 *
 * CRUD de la BIBLIOTHÈQUE de prompts (table `prompts`, modèle PAIRE) + gestion
 * atomique de la « paire par défaut » d'une langue.
 *
 *  POST { action: 'create',     title, language, outbound_body, inbound_body, is_default? } → { ok, id }
 *  POST { action: 'update', id, title?, language?, outbound_body?, inbound_body?, is_default? } → { ok }
 *  POST { action: 'set-default', id }                                                          → { ok }
 *  POST { action: 'delete',  id }                                                              → { ok }
 *
 * Réservé aux admins (requireAdmin sur le JWT appelant). Écriture en service-role.
 * La mise en défaut se fait en 2 temps (dé-cocher les autres PUIS cocher) pour ne
 * pas violer l'index unique partiel `prompts_one_default_per_lang`.
 * verify_jwt = false (auth gérée en interne, comme admin-credit-minutes).
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { requireAdmin } from '../_shared/requireAdmin.ts'

const LANGS = ['fr', 'en', 'es', 'de', 'it']
const MAX_TITLE = 120
const MAX_BODY = 20000

type Fields = { title?: string; language?: string; outbound_body?: string; inbound_body?: string }

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') return jsonResponse({ error: 'méthode non autorisée' }, 405)

  try {
    const admin = getSupabaseAdmin()

    const auth = await requireAdmin(req, admin)
    if ('error' in auth) return jsonResponse({ error: auth.error }, auth.status)

    const body = await req.json().catch(() => ({}))
    const action = String(body?.action ?? '')

    // ── CREATE ───────────────────────────────────────────────────────────────
    if (action === 'create') {
      const fields = validateFields(body, true)
      if ('error' in fields) return jsonResponse({ error: fields.error }, 400)

      const { data, error } = await admin
        .from('prompts')
        .insert({
          title: fields.title,
          language: fields.language,
          outbound_body: fields.outbound_body,
          inbound_body: fields.inbound_body,
          is_default: false,            // mis en défaut juste après si demandé (atomique)
          updated_by: auth.userId,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      if (body?.is_default === true) {
        await setDefault(admin, data.id, fields.language!)
      }
      return jsonResponse({ ok: true, id: data.id })
    }

    // ── UPDATE ───────────────────────────────────────────────────────────────
    if (action === 'update') {
      const id = String(body?.id ?? '').trim()
      if (!id) return jsonResponse({ error: 'id manquant' }, 400)

      const fields = validateFields(body, false)
      if ('error' in fields) return jsonResponse({ error: fields.error }, 400)

      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        updated_by: auth.userId,
      }
      if (fields.title !== undefined)         patch.title = fields.title
      if (fields.language !== undefined)      patch.language = fields.language
      if (fields.outbound_body !== undefined) patch.outbound_body = fields.outbound_body
      if (fields.inbound_body !== undefined)  patch.inbound_body = fields.inbound_body

      const { error } = await admin.from('prompts').update(patch).eq('id', id)
      if (error) throw new Error(error.message)

      // État final (la langue peut avoir changé) pour gérer le défaut.
      if (body?.is_default === true) {
        const { data: row } = await admin
          .from('prompts').select('language').eq('id', id).maybeSingle()
        if (row) await setDefault(admin, id, row.language)
      }
      return jsonResponse({ ok: true })
    }

    // ── SET-DEFAULT ──────────────────────────────────────────────────────────
    if (action === 'set-default') {
      const id = String(body?.id ?? '').trim()
      if (!id) return jsonResponse({ error: 'id manquant' }, 400)
      const { data: row, error } = await admin
        .from('prompts').select('language').eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      if (!row) return jsonResponse({ error: 'Prompt introuvable.' }, 404)
      await setDefault(admin, id, row.language)
      return jsonResponse({ ok: true })
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (action === 'delete') {
      const id = String(body?.id ?? '').trim()
      if (!id) return jsonResponse({ error: 'id manquant' }, 400)

      const { data: row } = await admin
        .from('prompts').select('language, is_default').eq('id', id).maybeSingle()

      const { error } = await admin.from('prompts').delete().eq('id', id)
      if (error) throw new Error(error.message)

      // Si on a supprimé le défaut, on promeut la plus récente paire restante de la
      // langue (pour conserver un défaut/fallback). Sinon → fallback fr / CODE_DEFAULT_*.
      if (row?.is_default) {
        const { data: sib } = await admin
          .from('prompts')
          .select('id')
          .eq('language', row.language)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (sib) await admin.from('prompts').update({ is_default: true }).eq('id', sib.id)
      }
      return jsonResponse({ ok: true })
    }

    return jsonResponse({ error: 'action inconnue' }, 400)
  } catch (err) {
    console.error('[admin-prompts] Erreur:', err)
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Erreur interne' },
      500,
    )
  }
})

/** Bascule la paire par défaut d'une langue en 2 temps (anti-violation index). */
async function setDefault(admin: SupabaseClient, id: string, language: string): Promise<void> {
  // 1. dé-cocher les autres défauts de la même langue
  await admin
    .from('prompts')
    .update({ is_default: false })
    .eq('language', language)
    .eq('is_default', true)
    .neq('id', id)
  // 2. cocher celle-ci
  await admin.from('prompts').update({ is_default: true }).eq('id', id)
}

/** Valide les champs. requireAll=true (create) impose tout ; sinon (update) ne
 *  valide que les champs PRÉSENTS. Renvoie { error } ou les champs nettoyés. */
function validateFields(body: Record<string, unknown>, requireAll: boolean): Fields | { error: string } {
  const out: Fields = {}

  if (requireAll || body?.title !== undefined) {
    const title = String(body?.title ?? '').trim()
    if (!title) return { error: 'Le titre est requis.' }
    if (title.length > MAX_TITLE) return { error: 'Titre trop long.' }
    out.title = title
  }
  if (requireAll || body?.language !== undefined) {
    const language = String(body?.language ?? '')
    if (!LANGS.includes(language)) return { error: 'Langue invalide.' }
    out.language = language
  }
  if (requireAll || body?.outbound_body !== undefined) {
    const text = String(body?.outbound_body ?? '')
    if (!text.trim()) return { error: 'Le prompt « appel émis » est requis.' }
    if (text.length > MAX_BODY) return { error: 'Prompt « appel émis » trop long.' }
    out.outbound_body = text
  }
  if (requireAll || body?.inbound_body !== undefined) {
    const text = String(body?.inbound_body ?? '')
    if (!text.trim()) return { error: 'Le prompt « appel entrant » est requis.' }
    if (text.length > MAX_BODY) return { error: 'Prompt « appel entrant » trop long.' }
    out.inbound_body = text
  }
  return out
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
