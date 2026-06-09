import { supabase } from '@/lib/supabase'
import type { MinutePackId } from '@modect/shared'

/**
 * Lance le paiement Stripe d'un pack de minutes : crée la session Checkout côté
 * serveur (Edge Fn create-checkout-session) puis redirige vers Stripe.
 *
 * Partagé vitrine (achat invité) + back-office (achat connecté). Si une session
 * utilisateur existe, le client supabase joint automatiquement le JWT → le
 * webhook créditera directement le compte (sans code).
 *
 * En cas d'échec, throw une Error (l'appelant gère l'affichage).
 */
export async function startCheckout(packId: MinutePackId): Promise<void> {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { pack_id: packId },
  })
  if (error) throw new Error(error.message ?? 'Le paiement n’a pas pu démarrer.')
  const url = (data as { url?: string } | null)?.url
  if (!url) throw new Error('Réponse de paiement invalide.')
  window.location.href = url
}
