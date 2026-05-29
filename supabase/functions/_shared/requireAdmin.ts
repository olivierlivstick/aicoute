import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Vérifie que l'appelant d'une Edge Function est un admin authentifié.
 *
 * `supabase.functions.invoke(...)` propage automatiquement le JWT de l'utilisateur
 * dans le header Authorization. On l'utilise pour identifier l'appelant, puis on
 * lit son rôle dans `profiles` via le client service-role passé en argument.
 *
 * Retourne { userId } si OK, sinon { error, status } à renvoyer tel quel.
 */
export async function requireAdmin(
  req: Request,
  admin: SupabaseClient,
): Promise<{ userId: string } | { error: string; status: number }> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return { error: 'Authentification requise', status: 401 }
  }

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData?.user) {
    return { error: 'Session invalide', status: 401 }
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  if (profileError || profile?.role !== 'admin') {
    return { error: 'Accès réservé aux administrateurs', status: 403 }
  }

  return { userId: userData.user.id }
}
