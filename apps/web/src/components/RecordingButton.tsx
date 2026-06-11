import { useState } from 'react'
import { Headphones } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/**
 * Bouton « .wav » (admin) — écoute l'enregistrement dual-channel d'un appel.
 *
 * Le WAV vit dans le bucket privé `fluidity-recordings`. On stocke le CHEMIN sur
 * la ligne d'appel (pas un lien signé qui expire) et on mint un lien signé à la
 * volée ici (RLS storage admin → migration 20260611000001). Rien si pas
 * d'enregistrement (appel non encore terminé, ou enregistrement désarmé).
 */
export function RecordingButton({ path }: { path: string | null | undefined }) {
  const [loading, setLoading] = useState(false)
  if (!path) return null

  async function open() {
    setLoading(true)
    try {
      const { data, error } = await supabase.storage
        .from('fluidity-recordings')
        .createSignedUrl(path!, 60 * 60)  // lien d'1 h, régénéré à chaque clic
      if (error || !data?.signedUrl) throw error ?? new Error('lien indisponible')
      window.open(data.signedUrl, '_blank', 'noopener')
    } catch {
      alert("Enregistrement indisponible (pas encore prêt, ou fichier supprimé).")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={open}
      disabled={loading}
      className="inline-flex items-center gap-1 text-xs text-brun-700 hover:underline disabled:opacity-50"
      title="Écouter l'enregistrement de la conversation (.wav)"
    >
      <Headphones size={12} className={loading ? 'animate-pulse' : ''} /> .wav
    </button>
  )
}
