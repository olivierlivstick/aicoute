import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Prompt } from '@modect/shared'

/**
 * Lecture de la bibliothèque de prompts (table `prompts`, RLS lecture
 * authentifiée). Un prompt = une PAIRE (émis + entrant) dans une langue.
 * Filtrable par langue. Tri : langue, défaut d'abord, puis ancienneté.
 * Sert aux menus déroulants (wizard / fiche) ET à l'admin (CRUD).
 */
export function usePrompts(filter?: { language?: string }) {
  const language = filter?.language
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('prompts')
      .select('*')
      .order('language', { ascending: true })
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
    if (language) q = q.eq('language', language)
    const { data, error: err } = await q
    if (err) setError(err.message)
    else setPrompts((data ?? []) as Prompt[])
    setLoading(false)
  }, [language])

  useEffect(() => { fetch() }, [fetch])

  return { prompts, loading, error, refetch: fetch }
}
